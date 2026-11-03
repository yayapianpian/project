import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { DA180DB } from '../src/db/db';
import { answerDiagnostic, finishDiagnostic, getActiveDiagnostic, saveProfile, sessionAttempts, setTaskStatus, startDiagnostic, regeneratePlan, resetAllData } from '../src/db/repo';
import { exportBackup, importBackup, parseBackup } from '../src/db/backup';
import { diagnosticState } from '../src/core/diagnostic';
import { gradeObjective } from '../src/core/grading';

let db: DA180DB;
beforeEach(async () => {
  db = new DA180DB('test-' + Math.random());
  await saveProfile({ displayName: '測試', startDate: '2026-11-03', dailyMinutes: 120, targetRole: '電商數據分析師', selfReport: { powerbi: true } }, db);
});

async function runDiagnostic(answerCorrectly: (domain: string) => boolean) {
  const s = await startDiagnostic(db);
  for (let i = 0; i < 40; i++) {
    const attempts = await sessionAttempts(s.id, db);
    const st = diagnosticState(attempts.map((a) => ({ questionId: a.questionId, correct: a.correct })), { powerbi: true });
    if (st.done) break;
    const q = st.next!;
    const ans = answerCorrectly(q.domain) ? q.correct : ['zzz'];
    const g = gradeObjective(q, ans);
    await answerDiagnostic(s.id, { questionId: q.id, domain: q.domain, concepts: q.concepts, difficulty: q.difficulty, answer: ans, correct: g.correct, scoreRatio: g.scoreRatio, hintLevel: 0, durationSec: 5, createdAt: new Date().toISOString() }, db);
  }
  return finishDiagnostic(s.id, db);
}

describe('diagnostic → plan flow', () => {
  it('creates personalized plan and resumes session', async () => {
    const s1 = await startDiagnostic(db);
    const s2 = await startDiagnostic(db);
    expect(s2.id).toBe(s1.id); // 重新整理後接續同一場
    const result = await runDiagnostic((d) => d === 'powerbi');
    expect(result.totalQuestions).toBe(30);
    expect(result.domainMastery.powerbi!).toBeGreaterThan(0.75);
    expect(result.domainMastery.sql!).toBeLessThan(0.2);
    expect(await getActiveDiagnostic(db)).toBeUndefined();
    const plan = await db.planDays.toArray();
    expect(plan.length).toBe(180);
    const daxDays = plan.filter((d) => d.moduleId === 'm4-dax').length;
    expect(daxDays).toBeLessThan(7);
    expect((await db.conceptMastery.count())).toBeGreaterThan(10);
    expect((await db.skillSnapshots.count())).toBe(1);
  });

  it('task status persists and survives regeneration', async () => {
    await runDiagnostic(() => true);
    const day1 = (await db.planDays.get(1))!;
    await setTaskStatus(1, day1.tasks[0].taskId, 'done', db);
    await regeneratePlan(db);
    expect((await db.planDays.get(1))!.tasks[0].status).toBe('done');
  });
});

describe('backup', () => {
  it('round-trips all data and excludes secrets', async () => {
    await runDiagnostic(() => true);
    await db.settings.put({ key: 'aiApiKey', value: 'sk-secret' });
    await db.files.put({ id: 'f1', ownerId: 'x', blob: new Blob(['hello'], { type: 'text/plain' }) });
    const backup = await exportBackup(db);
    const text = JSON.stringify(backup);
    expect(text).not.toContain('sk-secret');
    const { summary } = parseBackup(text);
    expect(summary.attempts).toBe(30);
    expect(summary.planDays).toBe(180);

    const other = new DA180DB('restore-' + Math.random());
    await other.settings.put({ key: 'aiApiKey', value: 'sk-local' });
    await importBackup(parseBackup(text).backup, other);
    expect(await other.attempts.count()).toBe(30);
    expect(await other.planDays.count()).toBe(180);
    expect((await other.profile.get('me'))!.displayName).toBe('測試');
    expect((await other.settings.get('aiApiKey'))!.value).toBe('sk-local');
    const f = await other.files.get('f1');
    expect(await (f!.blob as Blob).text()).toBe('hello');
  });

  it('rejects invalid files', () => {
    expect(() => parseBackup('not json')).toThrow();
    expect(() => parseBackup('{"app":"other"}')).toThrow();
  });

  it('reset clears everything', async () => {
    await runDiagnostic(() => true);
    await resetAllData(db);
    expect(await db.attempts.count()).toBe(0);
    expect(await db.profile.count()).toBe(0);
  });
});
