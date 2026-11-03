import { db as defaultDb, LOCAL_ONLY_SETTING_KEYS, markFromSync, SYNC_STORES, type DA180DB } from '../db/db';
import { recomputeMastery } from '../db/repo';
import type { PlanDay, PlanTask } from '../types/user';

// 跨裝置同步引擎：先下載雲端較新的資料並合併，再上傳本機修改過的資料。
// 規則：每筆資料以 _updatedAt 較新者為準（Last-Writer-Wins）；
// 學習計畫的每日任務另外逐項合併，避免兩台裝置各自勾選的任務互相覆蓋。

export interface RemoteRecord {
  store: string;
  key: string;
  data: Record<string, unknown>;
  updated_at: string;
  server_updated_at?: string;
}

export interface SyncRemote {
  /** 依 server_updated_at 由舊到新，回傳 since 之後的資料 */
  pull(since: string | null, limit: number): Promise<RemoteRecord[]>;
  push(records: RemoteRecord[]): Promise<void>;
  hasAnyData(): Promise<boolean>;
  deleteAll(): Promise<void>;
}

const PAGE = 500;
const CURSOR_KEY = 'sync.cursor';
const PUSHED_KEY = 'sync.pushedAt';

type Row = Record<string, unknown>;
const STORE_SET = new Map(SYNC_STORES.map((s) => [s.name, s]));

function keyOf(store: string, row: Row): string | null {
  const def = STORE_SET.get(store);
  if (!def) return null;
  if (def.uidKey) return typeof row.uid === 'string' ? row.uid : null;
  if (store === 'profile') return String(row.id);
  if (store === 'planDays') return String(row.dayIndex);
  if (store === 'skillSnapshots') return String(row.weekIndex);
  if (store === 'settings') return String(row.key);
  if (store === 'lessonProgress') return String(row.lessonId);
  if (store === 'mistakes') return String(row.questionId);
  return row.id === undefined ? null : String(row.id);
}

function shouldSync(store: string, row: Row): boolean {
  return !(store === 'settings' && LOCAL_ONLY_SETTING_KEYS.has(String(row.key)));
}

function ts(row: Row | undefined): string {
  return typeof row?._updatedAt === 'string' ? row._updatedAt : '';
}

/** 合併同一天的計畫：以較新的版本為主，再逐項套用另一版本中較新的任務狀態 */
export function mergePlanDay(a: PlanDay, b: PlanDay): PlanDay {
  const [base, other] = ts(a as unknown as Row) >= ts(b as unknown as Row) ? [a, b] : [b, a];
  const otherTasks = new Map(other.tasks.map((t) => [t.taskId, t]));
  const tasks: PlanTask[] = base.tasks.map((t) => {
    const o = otherTasks.get(t.taskId);
    if (o && (o.updatedAt ?? '') > (t.updatedAt ?? '')) {
      return { ...t, status: o.status, completedAt: o.completedAt, updatedAt: o.updatedAt };
    }
    return t;
  });
  return { ...base, tasks };
}

async function findLocal(dbi: DA180DB, store: string, key: string): Promise<Row | undefined> {
  const table = dbi.table(store);
  if (STORE_SET.get(store)?.uidKey) return table.where('uid').equals(key).first();
  if (store === 'planDays' || store === 'skillSnapshots') return table.get(Number(key));
  return table.get(key);
}

/** 套用下載的資料，回傳是否有作答紀錄變動（需要重算熟練度） */
async function applyRemote(dbi: DA180DB, records: RemoteRecord[]): Promise<boolean> {
  let attemptsChanged = false;
  const tables = SYNC_STORES.map((s) => dbi.table(s.name));
  await dbi.transaction('rw', tables, async (tx) => {
    markFromSync(tx);
    for (const r of records) {
      const def = STORE_SET.get(r.store);
      if (!def || !shouldSync(r.store, r.data)) continue;
      const table = dbi.table(r.store);
      const remote: Row = { ...r.data, _updatedAt: ts(r.data) || r.updated_at };
      const local = await findLocal(dbi, r.store, r.key);

      if (r.store === 'planDays' && local) {
        const merged = mergePlanDay(local as unknown as PlanDay, remote as unknown as PlanDay) as unknown as Row;
        const changedFromRemote = JSON.stringify(merged.tasks) !== JSON.stringify(remote.tasks);
        // 合併結果與雲端不同時，標記為新的修改，下一步會上傳回雲端
        if (changedFromRemote) merged._updatedAt = new Date().toISOString();
        await table.put(merged);
        continue;
      }
      if (local && ts(local) >= ts(remote)) continue;

      if (def.uidKey) {
        const row = { ...remote };
        delete row.id;
        if (local?.id !== undefined) row.id = local.id;
        await table.put(row);
      } else {
        await table.put(remote);
      }
      if (r.store === 'attempts') attemptsChanged = true;
    }
  });
  return attemptsChanged;
}

async function getMeta(dbi: DA180DB, key: string): Promise<string | null> {
  const v = (await dbi.meta.get(key))?.value;
  return typeof v === 'string' ? v : null;
}

export async function pullAll(remote: SyncRemote, dbi: DA180DB = defaultDb): Promise<number> {
  let since = await getMeta(dbi, CURSOR_KEY);
  let total = 0;
  let attemptsChanged = false;
  for (;;) {
    const rows = await remote.pull(since, PAGE);
    if (rows.length === 0) break;
    attemptsChanged = (await applyRemote(dbi, rows)) || attemptsChanged;
    total += rows.length;
    since = rows[rows.length - 1].server_updated_at ?? since;
    if (since) await dbi.meta.put({ key: CURSOR_KEY, value: since });
    if (rows.length < PAGE) break;
  }
  if (attemptsChanged) await recomputeMastery(dbi);
  return total;
}

export async function pushChanges(remote: SyncRemote, dbi: DA180DB = defaultDb): Promise<number> {
  const since = await getMeta(dbi, PUSHED_KEY);
  const startedAt = new Date().toISOString();
  const records: RemoteRecord[] = [];
  for (const { name, uidKey } of SYNC_STORES) {
    const rows = (await dbi.table(name).toArray()) as Row[];
    for (const row of rows) {
      if (!shouldSync(name, row)) continue;
      const updated = ts(row);
      if (since && updated && updated <= since) continue;
      const key = keyOf(name, row);
      if (!key) continue;
      const data = { ...row };
      if (uidKey) delete data.id;
      records.push({ store: name, key, data, updated_at: updated || startedAt });
    }
  }
  for (let i = 0; i < records.length; i += PAGE) await remote.push(records.slice(i, i + PAGE));
  await dbi.meta.put({ key: PUSHED_KEY, value: startedAt });
  return records.length;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
}

export async function syncOnce(remote: SyncRemote, dbi: DA180DB = defaultDb): Promise<SyncResult> {
  const pulled = await pullAll(remote, dbi);
  const pushed = await pushChanges(remote, dbi);
  return { pulled, pushed };
}

/** 是否曾經在這台裝置同步過 */
export async function hasSyncedBefore(dbi: DA180DB = defaultDb): Promise<boolean> {
  return (await getMeta(dbi, PUSHED_KEY)) !== null;
}

/** 這台裝置是否已有學習資料（用來判斷第一次登入時是否需要詢問） */
export async function hasLocalData(dbi: DA180DB = defaultDb): Promise<boolean> {
  return (await dbi.profile.count()) > 0;
}

/** 清除本機的同步資料（改用雲端資料時使用），保留只存在本機的設定 */
export async function clearLocalForCloud(dbi: DA180DB = defaultDb) {
  const keep = (await dbi.settings.toArray()).filter((r) => LOCAL_ONLY_SETTING_KEYS.has(r.key));
  await dbi.transaction('rw', dbi.tables, async () => {
    await Promise.all(dbi.tables.map((t) => t.clear()));
    if (keep.length) await dbi.settings.bulkPut(keep);
  });
}

/** 重新完整同步：下次會重新下載與上傳全部資料 */
export async function resetSyncState(dbi: DA180DB = defaultDb) {
  await dbi.meta.bulkDelete([CURSOR_KEY, PUSHED_KEY]);
}
