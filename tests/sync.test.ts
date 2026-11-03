import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DA180DB } from '../src/db/db';
import { answerDiagnostic, finishDiagnostic, saveProfile, sessionAttempts, setTaskStatus, startDiagnostic } from '../src/db/repo';
import { diagnosticState } from '../src/core/diagnostic';
import { gradeObjective } from '../src/core/grading';
import { clearLocalForCloud, mergePlanDay, syncOnce, type RemoteRecord, type SyncRemote } from '../src/sync/engine';
import type { PlanDay } from '../src/types/user';

/** 模擬 Supabase：較舊的 updated_at 不覆寫、server_updated_at 遞增 */
class MemoryRemote implements SyncRemote {
  rows = new Map<string, RemoteRecord>();
  private clock = 0;
  private serverTime() {
    this.clock++;
    return new Date(Date.UTC(2030, 0, 1) + this.clock).toISOString();
  }
  async pull(since: string | null, limit: number) {
    return [...this.rows.values()]
      .filter((r) => !since || r.server_updated_at! > since)
      .sort((a, b) => a.server_updated_at!.localeCompare(b.server_updated_at!))
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }
  async push(records: RemoteRecord[]) {
    for (const r of records) {
      const k = `${r.store}/${r.key}`;
      const old = this.rows.get(k);
      if (old && r.updated_at < old.updated_at) continue;
      this.rows.set(k, { ...structuredClone(r), server_updated_at: this.serverTime() });
    }
  }
  async hasAnyData() { return this.rows.size > 0; }
  async deleteAll() { this.rows.clear(); }
}

const newDb = () => new DA180DB('sync-' + Math.random());
const tick = () => new Promise((r) => setTimeout(r, 5));

async function setup(db: DA180DB) {
  await saveProfile({ displayName: '小安', startDate: '2026-11-03', dailyMinutes: 120, targetRole: '電商／零售數據分析師', selfReport: {} }, db);
  const s = await startDiagnostic(db);
  for (;;) {
    const at = await sessionAttempts(s.id, db);
    const st = diagnosticState(at.map((a) => ({ questionId: a.questionId, correct: a.correct })), {});
    if (st.done) break;
    const q = st.next!;
    const g = gradeObjective(q, q.domain === 'sql' ? q.correct : ['zzz']);
    await answerDiagnostic(s.id, { questionId: q.id, domain: q.domain, concepts: q.concepts, difficulty: q.difficulty, answer: [], correct: g.correct, scoreRatio: g.scoreRatio, hintLevel: 0, durationSec: 1, createdAt: new Date().toISOString() }, db);
  }
  await finishDiagnostic(s.id, db);
}

describe('sync engine', () => {
  it('second device receives everything and mastery is recomputed', async () => {
    const remote = new MemoryRemote();
    const pc = newDb();
    await setup(pc);
    await pc.settings.put({ key: 'sync.key', value: 'device-only' });
    const r1 = await syncOnce(remote, pc);
    expect(r1.pushed).toBeGreaterThan(200);
    expect([...remote.rows.keys()].some((k) => k.startsWith('settings/sync.'))).toBe(false);

    const phone = newDb();
    await syncOnce(remote, phone);
    expect(await phone.attempts.count()).toBe(30);
    expect(await phone.planDays.count()).toBe(180);
    expect((await phone.profile.get('me'))!.displayName).toBe('小安');
    expect(await phone.diagnostics.count()).toBe(1);
    expect(await phone.conceptMastery.count()).toBe(await pc.conceptMastery.count());

    // 再同步一次：沒有新變更時不重複上傳
    await tick();
    const again = await syncOnce(remote, phone);
    expect(again.pushed).toBeLessThan(5);
  });

  it('tasks checked on two devices on the same day are both kept', async () => {
    const remote = new MemoryRemote();
    const pc = newDb();
    await setup(pc);
    await syncOnce(remote, pc);
    const phone = newDb();
    await syncOnce(remote, phone);

    const day = (await pc.planDays.get(1))!;
    await tick();
    await setTaskStatus(1, day.tasks[0].taskId, 'done', pc);
    await tick();
    await setTaskStatus(1, day.tasks[1].taskId, 'done', phone);

    await syncOnce(remote, pc);
    await syncOnce(remote, phone);
    await syncOnce(remote, pc);

    for (const d of [pc, phone]) {
      const t = (await d.planDays.get(1))!.tasks;
      expect(t[0].status).toBe('done');
      expect(t[1].status).toBe('done');
    }
  });

  it('new attempts from both devices are merged, not overwritten', async () => {
    const remote = new MemoryRemote();
    const pc = newDb();
    await setup(pc);
    await syncOnce(remote, pc);
    const phone = newDb();
    await syncOnce(remote, phone);
    const base = { questionId: 'x', domain: 'sql' as const, concepts: ['sql.join.left'], difficulty: 3, context: 'quiz' as const, answer: [], correct: true, scoreRatio: 1, hintLevel: 0 as const, durationSec: 1, createdAt: new Date().toISOString() };
    await pc.attempts.add({ ...base });
    await phone.attempts.add({ ...base, correct: false, scoreRatio: 0 });
    await syncOnce(remote, pc);
    await syncOnce(remote, phone);
    await syncOnce(remote, pc);
    expect(await pc.attempts.count()).toBe(32);
    expect(await phone.attempts.count()).toBe(32);
    const uids = (await pc.attempts.toArray()).map((a) => a.uid);
    expect(new Set(uids).size).toBe(32);
  });

  it('newer profile edit wins', async () => {
    const remote = new MemoryRemote();
    const pc = newDb();
    await setup(pc);
    await syncOnce(remote, pc);
    const phone = newDb();
    await syncOnce(remote, phone);
    await tick();
    const p = (await phone.profile.get('me'))!;
    await phone.profile.put({ ...p, displayName: '手機改的' });
    await syncOnce(remote, phone);
    await syncOnce(remote, pc);
    expect((await pc.profile.get('me'))!.displayName).toBe('手機改的');
  });

  it('use-cloud option replaces local data', async () => {
    const remote = new MemoryRemote();
    const pc = newDb();
    await setup(pc);
    await syncOnce(remote, pc);
    const phone = newDb();
    await saveProfile({ displayName: '手機本機', startDate: '2026-12-01', dailyMinutes: 60, targetRole: 'x', selfReport: {} }, phone);
    await phone.settings.put({ key: 'sync.url', value: 'https://x' });
    await clearLocalForCloud(phone);
    await syncOnce(remote, phone);
    expect((await phone.profile.get('me'))!.displayName).toBe('小安');
    expect((await phone.settings.get('sync.url'))!.value).toBe('https://x');
  });

  it('mergePlanDay keeps newer task states from either side', () => {
    const mk = (_label: string, s: 'todo' | 'done', tu?: string) => ({ taskId: 't', type: 'lesson', moduleId: 'm', title: 'x', estMinutes: 1, status: s, updatedAt: tu }) as PlanDay['tasks'][0];
    const a = { dayIndex: 1, date: '', phaseId: 1, moduleId: 'm', tasks: [mk('', 'done', '2026-01-02')], _updatedAt: '2026-01-01' } as PlanDay;
    const b = { ...a, tasks: [mk('', 'todo', undefined)], _updatedAt: '2026-01-05' } as PlanDay;
    expect(mergePlanDay(a, b).tasks[0].status).toBe('done');
  });
});

describe('database upgrade v1 → v2', () => {
  it('adds uid and _updatedAt to existing rows', async () => {
    const Dexie = (await import('dexie')).default;
    const name = 'upgrade-' + Math.random();
    const v1 = new Dexie(name);
    v1.version(1).stores({ profile: 'id', diagnostics: '++id, takenAt, sessionId', planDays: 'dayIndex, date', attempts: '++id, questionId, *concepts, context, sessionId, createdAt', settings: 'key', meta: 'key' });
    await v1.table('attempts').add({ questionId: 'q', concepts: [], createdAt: 'x' });
    await v1.table('profile').put({ id: 'me', displayName: 'old' });
    v1.close();
    const v2 = new DA180DB(name);
    const a = (await v2.attempts.toArray())[0];
    expect(typeof a.uid).toBe('string');
    expect(typeof a._updatedAt).toBe('string');
    expect((await v2.profile.get('me'))!.displayName).toBe('old');
  });
});
