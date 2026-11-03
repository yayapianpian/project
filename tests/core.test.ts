import { describe, expect, it } from 'vitest';
import { gradeObjective } from '../src/core/grading';
import { masteryFrom, computeConceptMastery, PRIOR_VALUE } from '../src/core/mastery';
import { computeAbilityReport, gradeLabel } from '../src/core/scoring';
import { diagnosticState, nextDifficulty, QUESTIONS_PER_DOMAIN, DIAGNOSTIC_DOMAINS } from '../src/core/diagnostic';
import { allocateModuleDays, generatePlan, topicsForDay, carryOverStatus, currentDayIndex, PLAN_DAYS } from '../src/core/planner';
import { buildTopicPrompt, buildQuestionReviewPrompt } from '../src/core/aiPrompt';
import { DIAGNOSTIC_QUESTIONS, DIAGNOSTIC_BY_ID } from '../src/content/diagnosticQuestions';
import { CONCEPT_BY_ID } from '../src/content/concepts';
import { MODULES } from '../src/content/curriculum';
import type { Attempt } from '../src/types/user';

const now = new Date('2026-11-03T12:00:00Z');
const mk = (p: Partial<Attempt>): Attempt => ({
  questionId: 'q', domain: 'sql', concepts: ['sql.join.left'], difficulty: 3, context: 'quiz',
  answer: [], correct: true, scoreRatio: 1, hintLevel: 0, durationSec: 10, createdAt: now.toISOString(), ...p,
});

describe('content integrity', () => {
  it('curriculum totals 180 days with 30 per month', () => {
    expect(MODULES.reduce((s, m) => s + m.baseDays, 0)).toBe(180);
    for (let p = 1; p <= 6; p++) expect(MODULES.filter((m) => m.phase === p).reduce((s, m) => s + m.baseDays, 0)).toBe(30);
  });
  it('every referenced concept exists', () => {
    const refs = [...MODULES.flatMap((m) => m.concepts), ...DIAGNOSTIC_QUESTIONS.flatMap((q) => q.concepts)];
    for (const c of refs) expect(CONCEPT_BY_ID[c], c).toBeDefined();
  });
  it('diagnostic questions are well formed', () => {
    const ids = new Set<string>();
    for (const q of DIAGNOSTIC_QUESTIONS) {
      expect(ids.has(q.id)).toBe(false); ids.add(q.id);
      expect(q.explanation.length).toBeGreaterThan(20);
      if (q.type !== 'fill') {
        const opt = new Set(q.options!.map((o) => o.id));
        q.correct.forEach((c) => expect(opt.has(c), `${q.id} ${c}`).toBe(true));
      }
      expect(CONCEPT_BY_ID[q.concepts[0]].domain).toBe(q.domain);
    }
    for (const d of DIAGNOSTIC_DOMAINS) expect(DIAGNOSTIC_QUESTIONS.filter((q) => q.domain === d).length).toBeGreaterThanOrEqual(QUESTIONS_PER_DOMAIN + 2);
  });
});

describe('grading', () => {
  it('single / multi partial / fill numeric', () => {
    const single = DIAGNOSTIC_BY_ID['dg-sql-1'];
    expect(gradeObjective(single, ['a']).correct).toBe(true);
    expect(gradeObjective(single, ['b']).scoreRatio).toBe(0);
    const multi = DIAGNOSTIC_BY_ID['dg-data-3'];
    expect(gradeObjective(multi, ['a', 'b', 'c', 'd']).correct).toBe(true);
    expect(gradeObjective(multi, ['a', 'b']).scoreRatio).toBe(0.5);
    expect(gradeObjective(multi, ['a', 'b', 'c', 'd', 'e']).correct).toBe(false);
    expect(gradeObjective(multi, ['a', 'b', 'c', 'd', 'e']).scoreRatio).toBe(0.75);
    expect(gradeObjective(multi, ['e']).scoreRatio).toBe(0);
    const fill = DIAGNOSTIC_BY_ID['dg-biz-2'];
    expect(gradeObjective(fill, ['2.5']).correct).toBe(true);
    expect(gradeObjective(fill, [' 2.5% ']).correct).toBe(true);
    expect(gradeObjective(fill, ['25']).correct).toBe(false);
    expect(gradeObjective(DIAGNOSTIC_BY_ID['dg-pbi-5'], ['sum']).correct).toBe(true);
    expect(gradeObjective(DIAGNOSTIC_BY_ID['dg-data-7'], ['960']).correct).toBe(true);
    expect(gradeObjective(fill, ['']).correct).toBe(false);
  });
});

describe('mastery', () => {
  it('no evidence returns prior; hints reduce credit; old evidence decays', () => {
    expect(masteryFrom([], now)).toBe(PRIOR_VALUE);
    const clean = masteryFrom([mk({}), mk({}), mk({})], now);
    const hinted = masteryFrom([mk({ hintLevel: 2 }), mk({ hintLevel: 2 }), mk({ hintLevel: 2 })], now);
    const revealed = masteryFrom([mk({ hintLevel: 3 }), mk({ hintLevel: 3 }), mk({ hintLevel: 3 })], now);
    expect(clean).toBeGreaterThan(hinted);
    expect(hinted).toBeGreaterThan(revealed);
    const oldWrongNewRight = masteryFrom([mk({ correct: false, scoreRatio: 0, createdAt: '2026-06-01T00:00:00Z' }), mk({})], now);
    const oldRightNewWrong = masteryFrom([mk({ createdAt: '2026-06-01T00:00:00Z' }), mk({ correct: false, scoreRatio: 0 })], now);
    expect(oldWrongNewRight).toBeGreaterThan(oldRightNewWrong);
  });
  it('tracks consecutive wrong and status by evidence', () => {
    const list = [mk({}), mk({ correct: false, scoreRatio: 0 }), mk({ correct: false, scoreRatio: 0 }), mk({ correct: false, scoreRatio: 0 })]
      .map((a, i) => ({ ...a, createdAt: new Date(now.getTime() + i * 1000).toISOString() }));
    const [m] = computeConceptMastery(list, now);
    expect(m.consecutiveWrong).toBe(3);
    expect(m.evidenceCount).toBe(4);
    expect(m.status).toBe('weak');
    const [few] = computeConceptMastery([mk({})], now);
    expect(few.status).toBe('unknown');
  });
});

describe('scoring', () => {
  it('grade bands', () => {
    expect(gradeLabel(0)).toBe('初學者');
    expect(gradeLabel(40)).toBe('基礎建立中');
    expect(gradeLabel(74)).toBe('具備基礎實作能力');
    expect(gradeLabel(75)).toBe('具備獨立分析能力');
    expect(gradeLabel(90)).toBe('具備良好實務能力');
  });
  it('caps grade without exam/project evidence and totals 100-point scale', () => {
    const attempts = Array.from({ length: 6 }, (_, i) => mk({ difficulty: 5, context: 'diagnostic', createdAt: new Date(now.getTime() + i).toISOString() }));
    const masteries = computeConceptMastery(attempts, now);
    const report = computeAbilityReport(masteries, attempts);
    const sql = report.domains.find((d) => d.domain === 'sql')!;
    expect(sql.score100).toBeGreaterThanOrEqual(90);
    expect(sql.grade).toBe('具備基礎實作能力');
    expect(sql.capNote).toBeTruthy();
    expect(report.total).toBe(Math.round(sql.mastery! * 20));
    const py = report.domains.find((d) => d.domain === 'python')!;
    expect(py.mastery).toBeNull();
    expect(py.grade).toBeNull();
  });
});

describe('diagnostic engine', () => {
  it('adapts difficulty and finishes after 30 questions', () => {
    expect(nextDifficulty(3, [{ questionId: 'x', correct: true }, { questionId: 'y', correct: true }, { questionId: 'z', correct: true }])).toBe(5);
    expect(nextDifficulty(2, [{ questionId: 'x', correct: false }, { questionId: 'y', correct: false }])).toBe(1);
    const answered: { questionId: string; correct: boolean }[] = [];
    let st = diagnosticState(answered, { sql: true });
    expect(st.domain).toBe('data');
    expect(st.next!.difficulty).toBe(2);
    let guard = 0;
    while (!st.done && guard++ < 100) {
      answered.push({ questionId: st.next!.id, correct: true });
      st = diagnosticState(answered, { sql: true });
    }
    expect(answered.length).toBe(30);
    expect(new Set(answered.map((a) => a.questionId)).size).toBe(30);
    // SQL 自我回報有經驗 → 第一題難度 3
    const firstSql = answered.map((a) => DIAGNOSTIC_BY_ID[a.questionId]).find((q) => q.domain === 'sql')!;
    expect(firstSql.difficulty).toBe(3);
  });
});

describe('planner', () => {
  it('always produces exactly 180 days with consecutive dates', () => {
    for (const dm of [{}, { powerbi: 0.9, business: 0.8, data: 0.7 }, { sql: 0.1, python: 0.1, data: 0.1, powerbi: 0.1, business: 0.1 }, { sql: 0.95, python: 0.95, data: 0.95, powerbi: 0.95, business: 0.95 }]) {
      const plan = generatePlan({ startDate: '2026-11-03', dailyMinutes: 120, domainMastery: dm });
      expect(plan.length).toBe(PLAN_DAYS);
      expect(plan[0].date).toBe('2026-11-03');
      expect(plan[179].date).toBe('2027-05-01');
      plan.forEach((d, i) => expect(d.dayIndex).toBe(i + 1));
      const ids = plan.flatMap((d) => d.tasks.map((t) => t.taskId));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('compresses strong domains and extends weak ones', () => {
    const alloc = allocateModuleDays({ powerbi: 0.9, sql: 0.2 });
    const dax = alloc.find((p) => p.module.id === 'm4-dax')!;
    const join = alloc.find((p) => p.module.id === 'm2-join')!;
    expect(dax.days).toBeLessThan(7);
    expect(dax.adjust).toBe('compressed');
    expect(join.days).toBeGreaterThan(5);
    expect(alloc.reduce((s, p) => s + p.days, 0)).toBe(180);
  });
  it('distributes topics when compressed', () => {
    const m = MODULES.find((x) => x.id === 'm4-dax')!;
    const all = [0, 1, 2].flatMap((j) => topicsForDay(m, j, 3));
    expect(all).toEqual(m.topics);
  });
  it('keeps completed tasks when regenerating', () => {
    const a = generatePlan({ startDate: '2026-11-03', dailyMinutes: 120, domainMastery: {} });
    a[0].tasks[0].status = 'done';
    const b = carryOverStatus(a, generatePlan({ startDate: '2026-11-03', dailyMinutes: 120, domainMastery: {} }));
    expect(b[0].tasks[0].status).toBe('done');
  });
  it('day index', () => {
    expect(currentDayIndex('2026-11-03', '2026-11-03')).toBe(1);
    expect(currentDayIndex('2026-11-03', '2026-11-10')).toBe(8);
    expect(currentDayIndex('2026-11-03', '2026-11-01')).toBe(-1);
  });
});

describe('copy-to-AI prompts', () => {
  it('contains guided rules and context', () => {
    const t = buildTopicPrompt({ phaseTitle: 'SQL 專業訓練', moduleTitle: 'JOIN', topic: 'LEFT JOIN', domainLabel: 'SQL', domainGrade: null });
    expect(t).toContain('不要直接給答案');
    expect(t).toContain('LEFT JOIN');
    expect(t).toContain('證據不足');
    const r = buildQuestionReviewPrompt({ question: DIAGNOSTIC_BY_ID['dg-sql-6'], myAnswerText: '(c)', correctAnswerText: '(b)', wasCorrect: false });
    expect(r).toContain('我答錯了');
    expect(r).toContain('LEFT JOIN');
  });
});
