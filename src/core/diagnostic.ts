import { DIAGNOSTIC_QUESTIONS } from '../content/diagnosticQuestions';
import type { Domain, ObjectiveQuestion } from '../types/content';

// 自適應能力診斷：每區從中等難度開始，答對升一級、答錯降一級，每區 6 題。

export const DIAGNOSTIC_DOMAINS: Domain[] = ['data', 'sql', 'python', 'powerbi', 'business'];
export const QUESTIONS_PER_DOMAIN = 6;

export interface AnsweredItem {
  questionId: string;
  correct: boolean;
}

/** 自我回報有經驗的區塊從難度 3 開始，否則從 2 開始（自我回報不直接加分） */
export function startDifficulty(selfReported: boolean): number {
  return selfReported ? 3 : 2;
}

export function nextDifficulty(start: number, history: AnsweredItem[]): number {
  let d = start;
  for (const h of history) d = Math.min(5, Math.max(1, d + (h.correct ? 1 : -1)));
  return d;
}

/** 從尚未出過的題目中挑出最接近目標難度的一題；同難度時依題庫順序 */
export function pickQuestion(
  domain: Domain,
  target: number,
  usedIds: Set<string>,
  bank: ObjectiveQuestion[] = DIAGNOSTIC_QUESTIONS,
): ObjectiveQuestion | null {
  const candidates = bank.filter((q) => q.domain === domain && !usedIds.has(q.id));
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (const q of candidates) {
    if (Math.abs(q.difficulty - target) < Math.abs(best.difficulty - target)) best = q;
  }
  return best;
}

export interface DiagnosticState {
  done: boolean;
  domain?: Domain;
  domainIndex: number;
  questionInDomain: number;
  next?: ObjectiveQuestion;
  answeredCount: number;
  totalCount: number;
}

/** 由已作答紀錄（依作答順序）推算下一題，讓重新整理後可以接續 */
export function diagnosticState(
  answered: AnsweredItem[],
  selfReport: Partial<Record<Domain, boolean>>,
  bank: ObjectiveQuestion[] = DIAGNOSTIC_QUESTIONS,
): DiagnosticState {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const used = new Set(answered.map((a) => a.questionId));
  const totalCount = DIAGNOSTIC_DOMAINS.length * QUESTIONS_PER_DOMAIN;
  for (let i = 0; i < DIAGNOSTIC_DOMAINS.length; i++) {
    const domain = DIAGNOSTIC_DOMAINS[i];
    const history = answered.filter((a) => byId.get(a.questionId)?.domain === domain);
    if (history.length >= QUESTIONS_PER_DOMAIN) continue;
    const target = nextDifficulty(startDifficulty(!!selfReport[domain]), history);
    const next = pickQuestion(domain, target, used, bank);
    if (!next) continue;
    return {
      done: false,
      domain,
      domainIndex: i,
      questionInDomain: history.length,
      next,
      answeredCount: answered.length,
      totalCount,
    };
  }
  return { done: true, domainIndex: DIAGNOSTIC_DOMAINS.length, questionInDomain: 0, answeredCount: answered.length, totalCount };
}
