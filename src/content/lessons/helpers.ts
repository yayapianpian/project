import { CONCEPT_BY_ID } from '../concepts';
import { MODULE_BY_ID } from '../curriculum';
import type { Lesson, LessonQuestion } from '../../types/content';

type Opt = string | [text: string, whyWrong: string];
const ids = 'abcdefgh';

interface Base {
  id: string;
  c: string[];
  d: 1 | 2 | 3 | 4 | 5;
  q: string;
  code?: string;
  lang?: 'sql' | 'python' | 'dax' | 'text';
  exp: string;
  hint: string;
}

function domainOf(c: string[]) {
  const concept = CONCEPT_BY_ID[c[0]];
  if (!concept) throw new Error(`未知的概念：${c[0]}`);
  return concept.domain;
}

function options(opts: Opt[]) {
  const list = opts.map((o, i) => ({ id: ids[i], text: typeof o === 'string' ? o : o[0] }));
  const feedback: Record<string, string> = {};
  opts.forEach((o, i) => typeof o !== 'string' && (feedback[ids[i]] = o[1]));
  return { list, feedback };
}

/** 單選題；opts 中錯誤選項可寫成 [文字, 為什麼錯] */
export function sc(p: Base & { opts: Opt[]; ans: number }): LessonQuestion {
  const { list, feedback } = options(p.opts);
  return { id: p.id, domain: domainOf(p.c), type: 'single', difficulty: p.d, concepts: p.c, prompt: p.q, code: p.code, codeLang: p.lang, options: list, correct: [ids[p.ans]], explanation: p.exp, hint: p.hint, feedback };
}

/** 多選題 */
export function mc(p: Base & { opts: Opt[]; ans: number[] }): LessonQuestion {
  const { list, feedback } = options(p.opts);
  return { id: p.id, domain: domainOf(p.c), type: 'multi', difficulty: p.d, concepts: p.c, prompt: p.q, code: p.code, codeLang: p.lang, options: list, correct: p.ans.map((i) => ids[i]), explanation: p.exp, hint: p.hint, feedback };
}

/** 填空題（數值答案容差 0.01） */
export function fill(p: Base & { ans: (string | number)[]; wrong: string }): LessonQuestion {
  return { id: p.id, domain: domainOf(p.c), type: 'fill', difficulty: p.d, concepts: p.c, prompt: p.q, code: p.code, codeLang: p.lang, correct: p.ans.map(String), explanation: p.exp, hint: p.hint, wrongHint: p.wrong };
}

export function lesson(moduleId: string, topicIndex: number, l: Omit<Lesson, 'id' | 'moduleId' | 'topicIndex' | 'title'>): Lesson {
  const m = MODULE_BY_ID[moduleId];
  if (!m || !m.topics[topicIndex]) throw new Error(`找不到主題：${moduleId} #${topicIndex}`);
  return { id: `${moduleId}-${topicIndex + 1}`, moduleId, topicIndex, title: m.topics[topicIndex], ...l };
}

export const RETAIL_CSV = { title: '好日子超市 2026 Q1 銷售資料（retail_sales.csv）', file: 'datasets/retail_sales.csv' };
