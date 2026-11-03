import { computeConceptMastery, masteryFrom } from '../core/mastery';
import { computeAbilityReport } from '../core/scoring';
import { carryOverStatus, currentDayIndex, generatePlan } from '../core/planner';
import { DIAGNOSTIC_DOMAINS } from '../core/diagnostic';
import type { Domain } from '../types/content';
import type { Attempt, DiagnosticResult, PlanDay, Profile, QuizSession, TaskStatus } from '../types/user';
import { db as defaultDb, type DA180DB } from './db';

// 所有寫入操作集中在這裡，並包在 transaction 中，避免中途關閉頁面造成資料不一致。

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getProfile(db: DA180DB = defaultDb): Promise<Profile | undefined> {
  return db.profile.get('me');
}

export async function saveProfile(p: Omit<Profile, 'id' | 'createdAt'> & Partial<Pick<Profile, 'createdAt'>>, db: DA180DB = defaultDb) {
  const existing = await db.profile.get('me');
  const profile: Profile = { ...p, id: 'me', createdAt: existing?.createdAt ?? p.createdAt ?? new Date().toISOString() };
  await db.profile.put(profile);
  return profile;
}

/** 重新計算所有概念熟練度與本週能力快照（可由 attempts 完整重算） */
export async function recomputeMastery(db: DA180DB = defaultDb, now = new Date()) {
  const attempts = await db.attempts.toArray();
  const masteries = computeConceptMastery(attempts, now);
  await db.conceptMastery.clear();
  await db.conceptMastery.bulkPut(masteries);
  const profile = await db.profile.get('me');
  if (profile) {
    const report = computeAbilityReport(masteries, attempts);
    const dayIdx = Math.max(1, currentDayIndex(profile.startDate, todayISO(now)));
    const weekIndex = Math.ceil(dayIdx / 7);
    const domains: Partial<Record<Domain, number>> = {};
    report.domains.forEach((d) => d.mastery !== null && (domains[d.domain] = d.score100));
    await db.skillSnapshots.put({ weekIndex, takenAt: now.toISOString(), total: report.total, domains });
  }
}

export async function recordAttempt(a: Omit<Attempt, 'id'>, db: DA180DB = defaultDb) {
  return db.transaction('rw', [db.attempts, db.conceptMastery, db.skillSnapshots, db.profile], async () => {
    const id = await db.attempts.add(a as Attempt);
    await recomputeMastery(db, new Date(a.createdAt));
    return id;
  });
}

// ───────────── 能力診斷 ─────────────

export async function getActiveDiagnostic(db: DA180DB = defaultDb): Promise<QuizSession | undefined> {
  return db.quizSessions.where('status').equals('in_progress').filter((s) => s.mode === 'diagnostic').first();
}

export async function startDiagnostic(db: DA180DB = defaultDb): Promise<QuizSession> {
  const active = await getActiveDiagnostic(db);
  if (active) return active;
  const s: QuizSession = {
    id: uid('diag'),
    quizId: 'diagnostic-v1',
    mode: 'diagnostic',
    questionIds: [],
    startedAt: new Date().toISOString(),
    status: 'in_progress',
  };
  await db.quizSessions.put(s);
  return s;
}

export async function sessionAttempts(sessionId: string, db: DA180DB = defaultDb): Promise<Attempt[]> {
  const list = await db.attempts.where('sessionId').equals(sessionId).toArray();
  return list.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function answerDiagnostic(sessionId: string, a: Omit<Attempt, 'id' | 'sessionId' | 'context'>, db: DA180DB = defaultDb) {
  await db.transaction('rw', [db.attempts, db.conceptMastery, db.skillSnapshots, db.profile, db.quizSessions], async () => {
    // 同一題不重複記錄（例如連點兩次）
    const dup = await db.attempts.where('sessionId').equals(sessionId).filter((x) => x.questionId === a.questionId).count();
    if (dup > 0) return;
    await db.attempts.add({ ...a, sessionId, context: 'diagnostic' } as Attempt);
    const s = await db.quizSessions.get(sessionId);
    if (s) await db.quizSessions.put({ ...s, questionIds: [...s.questionIds, a.questionId] });
    await recomputeMastery(db, new Date(a.createdAt));
  });
}

export async function finishDiagnostic(sessionId: string, db: DA180DB = defaultDb): Promise<DiagnosticResult> {
  return db.transaction(
    'rw',
    [db.attempts, db.quizSessions, db.diagnostics, db.planDays, db.profile, db.meta],
    async () => {
      const attempts = await sessionAttempts(sessionId, db);
      const now = new Date();
      const domainMastery: Partial<Record<Domain, number>> = {};
      for (const d of DIAGNOSTIC_DOMAINS) {
        const list = attempts.filter((a) => a.domain === d);
        if (list.length > 0) domainMastery[d] = masteryFrom(list, now);
      }
      const totalCorrect = attempts.filter((a) => a.correct).length;
      const result: DiagnosticResult = {
        sessionId,
        takenAt: now.toISOString(),
        domainMastery,
        totalCorrect,
        totalQuestions: attempts.length,
      };
      const existing = await db.diagnostics.where('sessionId').equals(sessionId).first();
      if (existing) return existing;
      result.id = await db.diagnostics.add(result);

      const s = await db.quizSessions.get(sessionId);
      if (s) {
        const score = attempts.length ? Math.round((attempts.reduce((x, a) => x + a.scoreRatio, 0) / attempts.length) * 100) : 0;
        await db.quizSessions.put({ ...s, status: 'submitted', endedAt: now.toISOString(), score });
      }
      await regeneratePlanInTx(domainMastery, db);
      return result;
    },
  );
}

// ───────────── 180 天計畫 ─────────────

async function regeneratePlanInTx(domainMastery: Partial<Record<Domain, number>>, db: DA180DB) {
  const profile = await db.profile.get('me');
  if (!profile) throw new Error('尚未建立個人資料');
  const oldDays = await db.planDays.toArray();
  const fresh = generatePlan({ startDate: profile.startDate, dailyMinutes: profile.dailyMinutes, domainMastery });
  const merged = carryOverStatus(oldDays, fresh);
  await db.planDays.clear();
  await db.planDays.bulkPut(merged);
  await db.meta.put({ key: 'planGeneratedAt', value: new Date().toISOString() });
}

/** 依最新診斷結果（沒有則用預設）重新產生計畫，保留已完成的任務 */
export async function regeneratePlan(db: DA180DB = defaultDb) {
  return db.transaction('rw', [db.diagnostics, db.planDays, db.profile, db.meta], async () => {
    const latest = await db.diagnostics.orderBy('takenAt').last();
    await regeneratePlanInTx(latest?.domainMastery ?? {}, db);
  });
}

export async function setTaskStatus(dayIndex: number, taskId: string, status: TaskStatus, db: DA180DB = defaultDb) {
  await db.transaction('rw', db.planDays, async () => {
    const day = await db.planDays.get(dayIndex);
    if (!day) return;
    const tasks = day.tasks.map((t) =>
      t.taskId === taskId
        ? { ...t, status, completedAt: status === 'done' ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() }
        : t,
    );
    await db.planDays.put({ ...day, tasks } as PlanDay);
  });
}

export async function resetAllData(db: DA180DB = defaultDb) {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
