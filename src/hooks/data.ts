import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { computeAbilityReport } from '../core/scoring';

export function useProfile() {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

export function usePlan() {
  return useLiveQuery(() => db.planDays.orderBy('dayIndex').toArray(), []);
}

export function useAbilityReport() {
  return useLiveQuery(async () => {
    const [masteries, attempts] = await Promise.all([db.conceptMastery.toArray(), db.attempts.toArray()]);
    return { report: computeAbilityReport(masteries, attempts), masteries, attemptCount: attempts.length };
  }, []);
}

export function useQuizHistory() {
  return useLiveQuery(
    () => db.quizSessions.where('status').equals('submitted').sortBy('endedAt'),
    [],
  );
}

export function useLatestDiagnostic() {
  return useLiveQuery(async () => (await db.diagnostics.orderBy('takenAt').last()) ?? null, []);
}
