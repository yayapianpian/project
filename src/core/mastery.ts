import { CONCEPT_BY_ID } from '../content/concepts';
import type { Domain } from '../types/content';
import type { Attempt, AttemptContext, ConceptMastery } from '../types/user';

// 熟練度計算（docs/04-scoring.md 第 3 節）

export const PRIOR_VALUE = 0.3;
export const PRIOR_WEIGHT = 1;
export const HALF_LIFE_DAYS = 30;
export const MIN_EVIDENCE = 4;

const HINT_FACTOR: Record<0 | 1 | 2 | 3, number> = { 0: 1, 1: 0.8, 2: 0.5, 3: 0 };

const DIFFICULTY_WEIGHT: Record<number, number> = { 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.2, 5: 1.4 };

const CONTEXT_WEIGHT: Record<AttemptContext, number> = {
  lesson: 0.7,
  practice: 0.7,
  remediation: 0.7,
  review: 0.7,
  quiz: 1.0,
  diagnostic: 1.0,
  interview: 1.0,
  exam: 1.3,
  project: 1.3,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function evidenceValue(a: Pick<Attempt, 'scoreRatio' | 'hintLevel'>): number {
  return a.scoreRatio * HINT_FACTOR[a.hintLevel];
}

export function attemptWeight(a: Pick<Attempt, 'difficulty' | 'context' | 'createdAt'>, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - new Date(a.createdAt).getTime()) / DAY_MS);
  const recency = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  return (DIFFICULTY_WEIGHT[a.difficulty] ?? 1) * CONTEXT_WEIGHT[a.context] * recency;
}

/** 由一組作答計算熟練度（0–1） */
export function masteryFrom(attempts: Attempt[], now: Date): number {
  let num = PRIOR_VALUE * PRIOR_WEIGHT;
  let den = PRIOR_WEIGHT;
  for (const a of attempts) {
    const w = attemptWeight(a, now);
    num += w * evidenceValue(a);
    den += w;
  }
  return num / den;
}

/** 依時間排序的作答，計算每個概念的熟練度紀錄 */
export function computeConceptMastery(attempts: Attempt[], now: Date = new Date()): ConceptMastery[] {
  const sorted = [...attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const byConcept = new Map<string, Attempt[]>();
  for (const a of sorted) {
    for (const c of a.concepts) {
      if (!byConcept.has(c)) byConcept.set(c, []);
      byConcept.get(c)!.push(a);
    }
  }
  const result: ConceptMastery[] = [];
  byConcept.forEach((list, conceptId) => {
    const concept = CONCEPT_BY_ID[conceptId];
    const domain: Domain = concept?.domain ?? list[0].domain;
    const mastery = masteryFrom(list, now);
    let consecutiveWrong = 0;
    for (let i = list.length - 1; i >= 0 && !list[i].correct; i--) consecutiveWrong++;
    const evidenceCount = list.length;
    let status: ConceptMastery['status'];
    if (evidenceCount < MIN_EVIDENCE) status = 'unknown';
    else if (mastery < 0.4) status = 'weak';
    else if (mastery < 0.6) status = 'learning';
    else status = 'ok';
    result.push({
      conceptId,
      domain,
      mastery,
      evidenceCount,
      consecutiveWrong,
      recentResults: list.slice(-5).map((a) => evidenceValue(a)),
      status,
      updatedAt: now.toISOString(),
    });
  });
  return result;
}
