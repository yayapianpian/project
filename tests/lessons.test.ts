import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { LESSONS, lessonsForTask } from '../src/content/lessons';
import { MODULES } from '../src/content/curriculum';
import { CONCEPT_BY_ID } from '../src/content/concepts';
import { gradeObjective } from '../src/core/grading';
import { generatePlan } from '../src/core/planner';

describe('lesson content', () => {
  it('month 1 and 2 topics with lessons are complete and well formed', () => {
    const ids = new Set<string>();
    for (const l of LESSONS) {
      expect(l.workUseCase.length, l.id).toBeGreaterThan(20);
      expect(l.body.length, l.id).toBeGreaterThan(200);
      expect(l.steps.length, l.id).toBeGreaterThanOrEqual(2);
      expect(l.practice.length, l.id).toBeGreaterThanOrEqual(2);
      expect(l.quiz.length, l.id).toBeGreaterThanOrEqual(5);
      expect(l.commonMistakes.length, l.id).toBeGreaterThanOrEqual(2);
      for (const d of l.datasets ?? []) expect(existsSync('public/' + d.file), d.file).toBe(true);
      for (const q of [...l.practice, ...l.quiz]) {
        expect(ids.has(q.id), q.id).toBe(false);
        ids.add(q.id);
        q.concepts.forEach((c) => expect(CONCEPT_BY_ID[c], `${q.id} ${c}`).toBeDefined());
        expect(q.hint.length, q.id).toBeGreaterThan(3);
        expect(q.explanation.length, q.id).toBeGreaterThan(10);
        expect(q.correct.length, q.id).toBeGreaterThan(0);
        q.correct.forEach((c) => expect(c, q.id).not.toBe(''));
        if (q.type === 'fill') expect(q.wrongHint, q.id).toBeTruthy();
        else {
          const opts = new Set(q.options!.map((o) => o.id));
          q.correct.forEach((c) => expect(opts.has(c), `${q.id} ${c}`).toBe(true));
          // 錯誤選項的回饋不能掛在正確答案上
          Object.keys(q.feedback ?? {}).forEach((k) => expect(q.correct.includes(k), `${q.id} feedback on correct ${k}`).toBe(false));
        }
        expect(gradeObjective(q, q.correct).correct, q.id).toBe(true);
      }
      // 練習題的「錯在哪」與「提示」不能直接透露數字答案
      for (const q of l.practice.filter((x) => x.type === 'fill')) {
        for (const t of [q.hint, q.wrongHint ?? '']) {
          const plain = t.replace(/,/g, '');
          q.correct.filter((c) => /^-?\d/.test(c) && c.length >= 2).forEach((c) => expect(plain.includes(c), `${q.id} 提示洩漏答案 ${c}`).toBe(false));
        }
      }
    }
    // 第一個月每個主題都有單元
    for (const m of MODULES.filter((x) => x.phase === 1)) {
      m.topics.forEach((_, i) => expect(LESSONS.some((l) => l.moduleId === m.id && l.topicIndex === i), `${m.id} #${i}`).toBe(true));
    }
  });

  it('daily tasks link to lessons', () => {
    const plan = generatePlan({ startDate: '2026-11-04', dailyMinutes: 120, domainMastery: {} });
    const day1 = plan[0].tasks.find((t) => t.type === 'lesson')!;
    expect(lessonsForTask(day1).map((l) => l.id)).toEqual(['m1-mindset-1']);
  });
});
