import type { Lesson } from '../../types/content';
import type { PlanTask } from '../../types/user';
import { MODULE_BY_ID } from '../curriculum';
import { MONTH1A } from './month1a';
import { MONTH1B } from './month1b';
import { MONTH1C } from './month1c';
import { MONTH1D } from './month1d';
import { registerModuleLessonCount } from '../../db/repo';

export const LESSONS: Lesson[] = [...MONTH1A, ...MONTH1B, ...MONTH1C, ...MONTH1D].sort((a, b) => {
  const ma = Object.keys(MODULE_BY_ID).indexOf(a.moduleId);
  const mb = Object.keys(MODULE_BY_ID).indexOf(b.moduleId);
  return ma - mb || a.topicIndex - b.topicIndex;
});

export const LESSON_BY_ID: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

export function lessonFor(moduleId: string, topicIndex: number): Lesson | undefined {
  return LESSON_BY_ID[`${moduleId}-${topicIndex + 1}`];
}

/** 每日任務標題中提到的主題，對應到哪些課程單元 */
export function lessonsForTask(task: PlanTask): Lesson[] {
  const m = MODULE_BY_ID[task.moduleId];
  if (!m) return [];
  return m.topics
    .map((t, i) => (task.title.includes(t) ? lessonFor(m.id, i) : undefined))
    .filter((l): l is Lesson => !!l);
}

/** 依課程順序的下一個單元 */
export function nextLesson(id: string): Lesson | undefined {
  const i = LESSONS.findIndex((l) => l.id === id);
  return i >= 0 ? LESSONS[i + 1] : undefined;
}

// 讓「單元測驗」任務對應到模組最後一個單元的小測
for (const id of new Set(LESSONS.map((l) => l.moduleId))) {
  registerModuleLessonCount(id, MODULE_BY_ID[id].topics.length);
}
