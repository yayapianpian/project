import type { SqlResult } from '../engines/sqlEngine';

// SQL 練習批改：比對使用者與標準答案的「查詢結果」，而不是比對程式碼文字。

export interface SqlCheck {
  /** 標準答案查詢 */
  reference: string;
  /** 是否要求列的順序一致（題目要求排序時） */
  orderMatters?: boolean;
  /** 題目要求必須使用的語法 */
  mustUse?: { pattern: string; label: string }[];
  /** 編輯器預設內容 */
  starter?: string;
}

export interface SqlGradeResult {
  correct: boolean;
  /** 第一段「錯在哪」：不透露答案的診斷 */
  where?: string;
}

function norm(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'number') return String(Math.round(v * 100) / 100);
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return String(Math.round(Number(v) * 100) / 100);
  if (typeof v === 'boolean') return v ? 't' : 'f';
  return String(v);
}

const rowKey = (r: unknown[]) => JSON.stringify(r.map(norm));

export function compareSqlResults(user: SqlResult, ref: SqlResult, check: Pick<SqlCheck, 'orderMatters' | 'mustUse'>, userSql: string): SqlGradeResult {
  if (user.columns.length !== ref.columns.length) {
    return { correct: false, where: `你的結果有 ${user.columns.length} 個欄位，題目要求 ${ref.columns.length} 個欄位。再看一次題目要列出哪些資訊。` };
  }
  if (user.rows.length !== ref.rows.length) {
    return user.rows.length > ref.rows.length
      ? { correct: false, where: `你的結果有 ${user.rows.length} 列，比正確答案多。可能少了篩選條件、少了 GROUP BY，或 JOIN 讓列數膨脹了。` }
      : { correct: false, where: `你的結果有 ${user.rows.length} 列，比正確答案少。可能篩選條件太嚴格、日期範圍不對，或 INNER JOIN 漏掉了資料。` };
  }
  const u = user.rows.map(rowKey);
  const r = ref.rows.map(rowKey);
  const sortedEqual = [...u].sort().join('\n') === [...r].sort().join('\n');
  if (!sortedEqual) {
    // 找出第一個有差異的欄位（依排序後比較）
    const us = [...user.rows].sort((a, b) => rowKey(a).localeCompare(rowKey(b)));
    const rs = [...ref.rows].sort((a, b) => rowKey(a).localeCompare(rowKey(b)));
    let col = -1;
    for (let c = 0; c < ref.columns.length && col < 0; c++) {
      const a = us.map((x) => norm(x[c])).sort().join('|');
      const b = rs.map((x) => norm(x[c])).sort().join('|');
      if (a !== b) col = c;
    }
    const name = col >= 0 ? `第 ${col + 1} 欄（${user.columns[col]}）` : '部分欄位';
    return { correct: false, where: `列數和欄位數都對了，但${name}的值和正確答案不同。檢查計算方式、條件或欄位順序。` };
  }
  if (check.orderMatters && u.join('\n') !== r.join('\n')) {
    return { correct: false, where: '內容都正確，但排列順序不對。檢查 ORDER BY 的欄位與方向。' };
  }
  const missing = (check.mustUse ?? []).find((m) => !new RegExp(m.pattern, 'i').test(userSql));
  if (missing) return { correct: false, where: `結果正確！但這題要練習使用 ${missing.label}，請用 ${missing.label} 再寫一次。` };
  return { correct: true };
}
