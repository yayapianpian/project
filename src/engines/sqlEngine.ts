import type { PGlite } from '@electric-sql/pglite';

// 瀏覽器內的 PostgreSQL（PGlite）。每次查詢都在交易中執行並回滾，練習資料庫永遠不會被改壞。

export interface SqlResult {
  columns: string[];
  rows: unknown[][];
  ms: number;
}

let shared: Promise<PGlite> | null = null;

export async function createShopDb(seedSql: string): Promise<PGlite> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(seedSql);
  return db;
}

/** 取得共用的「好日子線上商城」資料庫（第一次會下載 SQL 引擎與資料） */
export function getShopDb(): Promise<PGlite> {
  if (!shared) {
    shared = fetch('datasets/shop.sql')
      .then((r) => {
        if (!r.ok) throw new Error('無法下載練習資料庫');
        return r.text();
      })
      .then(createShopDb)
      .catch((e) => {
        shared = null;
        throw e;
      });
  }
  return shared;
}

export async function runSql(db: PGlite, sql: string): Promise<SqlResult> {
  const t0 = performance.now();
  let out: SqlResult = { columns: [], rows: [], ms: 0 };
  await db.transaction(async (tx) => {
    await tx.exec('SET LOCAL statement_timeout = 4000');
    const results = await tx.exec(sql, { rowMode: 'array' });
    const last = [...results].reverse().find((r) => r.fields.length > 0);
    out = { columns: last?.fields.map((f) => f.name) ?? [], rows: (last?.rows as unknown[][]) ?? [], ms: 0 };
    await tx.rollback();
  });
  out.ms = Math.round(performance.now() - t0);
  return out;
}

/** 把 PostgreSQL 錯誤訊息翻成看得懂的中文說明（不透露答案） */
export function explainSqlError(message: string): string {
  const m = (re: RegExp) => message.match(re);
  let r: RegExpMatchArray | null;
  if ((r = m(/column "([^"]+)" does not exist/))) return `找不到欄位 ${r[1]}：檢查欄位名稱的拼字，或這個欄位是不是在另一張資料表。`;
  if ((r = m(/relation "([^"]+)" does not exist/))) return `找不到資料表 ${r[1]}：檢查資料表名稱的拼字。`;
  if ((r = m(/syntax error at or near "([^"]*)"/))) return `語法錯誤：在「${r[1]}」附近。常見原因是少了逗號、括號不成對，或子句的順序不對。`;
  if (/syntax error at end of input/.test(message)) return '語法錯誤：查詢好像還沒寫完（例如少了結尾的括號或條件）。';
  if ((r = m(/column "([^"]+)" must appear in the GROUP BY clause/))) return `欄位 ${r[1]} 沒有放進 GROUP BY，也沒有用聚合函數。SELECT 中的非聚合欄位都要出現在 GROUP BY。`;
  if (/aggregate functions are not allowed in WHERE/.test(message)) return 'WHERE 裡不能使用聚合函數（例如 COUNT、SUM）。篩選分組後的結果要用另一個子句。';
  if ((r = m(/column reference "([^"]+)" is ambiguous/))) return `欄位 ${r[1]} 同時存在於多張資料表，請加上資料表別名，例如 o.${r[1]}。`;
  if ((r = m(/operator does not exist: (\w+) [^ ]+ (\w+)/))) return `型別不相容：不能直接比較 ${r[1]} 和 ${r[2]}。檢查是否把數字寫成文字（加了引號），或需要轉型。`;
  if (/division by zero/.test(message)) return '除以零：分母可能為 0，可以用 NULLIF(分母, 0) 保護。';
  if (/statement timeout/.test(message)) return '查詢執行太久被中止：可能少了 JOIN 條件，造成資料表交叉相乘。';
  if ((r = m(/missing FROM-clause entry for table "([^"]+)"/))) return `使用了別名 ${r[1]}，但 FROM 或 JOIN 中沒有定義它。`;
  if (/invalid input syntax for type (date|integer|numeric)/.test(message)) return '資料格式不符：例如日期要寫成 \'2026-01-31\'，數字不要加引號。';
  if (/window functions are not allowed in WHERE/.test(message)) return 'WHERE 裡不能使用視窗函數：先在子查詢或 CTE 算出來，再在外層篩選。';
  return `執行錯誤：${message}`;
}
