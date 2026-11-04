import type { LessonQuestion } from '../types/content';
import { gradeObjective } from './grading';
import { compareSqlResults } from './sqlGrade';

export interface QuestionGrade {
  correct: boolean;
  ratio: number;
  /** 第一段：錯在哪（不透露答案） */
  where?: string;
}

/** 選擇題／填空題答錯時的「錯在哪」 */
export function whereWrong(q: LessonQuestion, answer: string[]): string {
  if (q.type === 'fill') return q.wrongHint ?? '答案不正確，請再檢查一次。';
  const wrongPick = answer.find((a) => !q.correct.includes(a));
  if (q.type === 'single') return (wrongPick && q.feedback?.[wrongPick]) || '這個選項不正確，再想想看。';
  const hit = answer.filter((a) => q.correct.includes(a)).length;
  const extra = answer.length - hit;
  const parts = [`你選對了 ${hit} / ${q.correct.length} 個正確選項`];
  if (extra > 0) parts.push(`另外多選了 ${extra} 個錯誤選項`);
  const fb = wrongPick && q.feedback?.[wrongPick];
  return parts.join('，') + '。' + (fb ? `\n例如 (${wrongPick})：${fb}` : '');
}

/** 批改任何課程題目；SQL 題會在瀏覽器內的 PostgreSQL 執行並比對結果 */
export async function gradeLessonQuestion(q: LessonQuestion, answer: string[]): Promise<QuestionGrade> {
  if (q.type === 'sql' && q.sql) {
    const sql = (answer[0] ?? '').trim();
    if (!sql) return { correct: false, ratio: 0, where: '還沒有輸入 SQL。' };
    const { getShopDb, runSql, explainSqlError } = await import('../engines/sqlEngine');
    const db = await getShopDb();
    let user;
    try {
      user = await runSql(db, sql);
    } catch (e) {
      return { correct: false, ratio: 0, where: explainSqlError((e as Error).message) };
    }
    const ref = await runSql(db, q.sql.reference);
    const r = compareSqlResults(user, ref, q.sql, sql);
    return { correct: r.correct, ratio: r.correct ? 1 : 0, where: r.where };
  }
  const g = gradeObjective(q, answer);
  return { correct: g.correct, ratio: g.scoreRatio, where: g.correct ? undefined : whereWrong(q, answer) };
}
