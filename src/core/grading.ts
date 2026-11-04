import type { ObjectiveQuestion } from '../types/content';

export interface GradeResult {
  correct: boolean;
  /** 0–1 */
  scoreRatio: number;
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '').replace(/[，,]/g, '').replace(/%$/, '');
}

function asNumber(s: string): number | null {
  const n = Number(normalizeText(s));
  return Number.isFinite(n) && normalizeText(s) !== '' ? n : null;
}

/** 批改客觀題：單選、多選（部分給分）、填空（文字或數值容差 0.01） */
export function gradeObjective(q: ObjectiveQuestion, answer: string[]): GradeResult {
  if (q.type === 'sql') return { correct: false, scoreRatio: 0 }; // SQL 題由 sqlGrade 以查詢結果批改
  if (q.type === 'single') {
    const ok = answer.length === 1 && answer[0] === q.correct[0];
    return { correct: ok, scoreRatio: ok ? 1 : 0 };
  }
  if (q.type === 'multi') {
    const correctSet = new Set(q.correct);
    const chosen = new Set(answer);
    let hit = 0;
    let wrong = 0;
    chosen.forEach((id) => (correctSet.has(id) ? hit++ : wrong++));
    const ratio = Math.max(0, (hit - wrong) / correctSet.size);
    const ok = hit === correctSet.size && wrong === 0;
    return { correct: ok, scoreRatio: ok ? 1 : ratio };
  }
  // fill
  const given = answer[0] ?? '';
  const givenNum = asNumber(given);
  const ok = q.correct.some((acc) => {
    const accNum = asNumber(acc);
    if (givenNum !== null && accNum !== null) return Math.abs(givenNum - accNum) <= 0.01;
    return normalizeText(acc) === normalizeText(given);
  });
  return { correct: ok, scoreRatio: ok ? 1 : 0 };
}
