import { db as defaultDb, SCHEMA_VERSION, STORE_NAMES, type DA180DB, type StoreName } from './db';

// 備份與還原（docs/03-database.md「版本遷移與備份」）

export interface BackupFile {
  app: 'da180';
  schemaVersion: number;
  exportedAt: string;
  stores: Partial<Record<StoreName, unknown[]>>;
}

/** 永遠不匯出的設定（例如日後的 AI API Key） */
const SECRET_SETTING_KEYS = new Set(['aiApiKey', 'sync.key', 'sync.url']);

async function blobToBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBackup(db: DA180DB = defaultDb): Promise<BackupFile> {
  const stores: BackupFile['stores'] = {};
  for (const name of STORE_NAMES) {
    let rows = (await db.table(name).toArray()) as Record<string, unknown>[];
    if (name === 'settings') rows = rows.filter((r) => !SECRET_SETTING_KEYS.has(String(r.key)));
    if (name === 'files') {
      rows = await Promise.all(
        rows.map(async (r) =>
          r.blob instanceof Blob ? { ...r, blob: undefined, base64: await blobToBase64(r.blob), mime: r.blob.type } : r,
        ),
      );
    }
    stores[name] = rows;
  }
  return { app: 'da180', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), stores };
}

export interface BackupSummary {
  exportedAt: string;
  attempts: number;
  planDays: number;
  diagnostics: number;
  projects: number;
}

export function parseBackup(text: string): { backup: BackupFile; summary: BackupSummary } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('檔案不是有效的 JSON。');
  }
  const b = data as BackupFile;
  if (!b || b.app !== 'da180' || typeof b.schemaVersion !== 'number' || typeof b.stores !== 'object') {
    throw new Error('這不是 Data Analyst 180 的備份檔。');
  }
  if (b.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`備份檔版本（${b.schemaVersion}）比目前網站新，請先更新網站。`);
  }
  const len = (k: StoreName) => (Array.isArray(b.stores[k]) ? b.stores[k]!.length : 0);
  return {
    backup: b,
    summary: {
      exportedAt: b.exportedAt,
      attempts: len('attempts'),
      planDays: len('planDays'),
      diagnostics: len('diagnostics'),
      projects: len('projectSubmissions'),
    },
  };
}

/** 以備份內容覆寫目前所有資料 */
export async function importBackup(backup: BackupFile, db: DA180DB = defaultDb) {
  await db.transaction('rw', db.tables, async () => {
    for (const name of STORE_NAMES) {
      const table = db.table(name);
      // 保留本機的機密設定（例如 API Key），不被備份覆蓋
      const keep = name === 'settings' ? (await table.toArray()).filter((r) => SECRET_SETTING_KEYS.has(String(r.key))) : [];
      await table.clear();
      let rows = (backup.stores[name] ?? []) as Record<string, unknown>[];
      if (name === 'files') {
        rows = rows.map((r) =>
          typeof r.base64 === 'string' ? { ...r, blob: base64ToBlob(r.base64, String(r.mime ?? '')), base64: undefined } : r,
        );
      }
      if (rows.length) await table.bulkPut(rows);
      if (keep.length) await table.bulkPut(keep);
    }
    await db.meta.put({ key: 'lastImportAt', value: new Date().toISOString() });
  });
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function markBackedUp(db: DA180DB = defaultDb) {
  await db.meta.put({ key: 'lastBackupAt', value: new Date().toISOString() });
}

// ───────────── 持久化儲存 ─────────────

export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}
