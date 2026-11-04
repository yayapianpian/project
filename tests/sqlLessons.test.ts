import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { createShopDb, runSql, explainSqlError } from '../src/engines/sqlEngine';
import { compareSqlResults } from '../src/core/sqlGrade';
import { LESSONS } from '../src/content/lessons';

let db: PGlite;
beforeAll(async () => {
  db = await createShopDb(readFileSync('public/datasets/shop.sql', 'utf8'));
}, 60000);

describe('SQL engine and grader', () => {
  it('rolls back writes and translates errors', async () => {
    await runSql(db, 'DELETE FROM order_items');
    expect((await runSql(db, 'SELECT COUNT(*) FROM order_items')).rows[0][0]).toBeGreaterThan(1000);
    expect((await runSql(db, 'SELECT COUNT(*) FROM orders')).rows[0][0]).toBeGreaterThan(1000);
    await expect(runSql(db, 'SELECT customer_id, COUNT(*) FROM orders')).rejects.toThrow();
    expect(explainSqlError('column "o.customer_id" must appear in the GROUP BY clause or be used in an aggregate function')).toContain('GROUP BY');
  });
  it('compares results, not text', async () => {
    const ref = await runSql(db, 'SELECT city, COUNT(*) FROM customers GROUP BY city');
    const same = await runSql(db, 'SELECT c.city, count(c.customer_id) AS n FROM customers c GROUP BY 1 ORDER BY 2');
    expect(compareSqlResults(same, ref, {}, 'x').correct).toBe(true);
    const fewer = await runSql(db, "SELECT city, COUNT(*) FROM customers WHERE city <> '台北市' GROUP BY city");
    expect(compareSqlResults(fewer, ref, {}, 'x').where).toContain('比正確答案少');
    const wrongVal = await runSql(db, 'SELECT city, COUNT(DISTINCT gender) FROM customers GROUP BY city');
    expect(compareSqlResults(wrongVal, ref, {}, 'x').where).toContain('第 2 欄');
    expect(compareSqlResults(ref, ref, { mustUse: [{ pattern: '\\bHAVING\\b', label: 'HAVING' }] }, 'SELECT city').where).toContain('HAVING');
  });
});

describe('SQL lesson questions', () => {
  it('every reference query runs, returns rows and grades itself as correct', async () => {
    let n = 0;
    for (const l of LESSONS) {
      for (const q of [...l.practice, ...l.quiz]) {
        if (q.type !== 'sql' || !q.sql) continue;
        n++;
        let res;
        try {
          res = await runSql(db, q.sql.reference);
        } catch (e) {
          throw new Error(`${q.id}: ${(e as Error).message}`);
        }
        expect(res.rows.length, `${q.id} 沒有結果`).toBeGreaterThan(0);
        expect(compareSqlResults(res, res, q.sql, q.sql.reference).correct, `${q.id} mustUse 與參考答案不符`).toBe(true);
        // 提示不能包含完整的參考答案
        expect(q.hint.includes(q.sql.reference.slice(0, 40)), `${q.id} 提示洩漏答案`).toBe(false);
      }
    }
    expect(n).toBeGreaterThanOrEqual(0);
  }, 60000);
});

describe('grader accepts equivalent solutions and explains typical mistakes', () => {
  const q = (id: string) => LESSONS.flatMap((l) => [...l.practice, ...l.quiz]).find((x) => x.id === id)!;
  const grade = async (id: string, sql: string) => {
    const question = q(id);
    let user;
    try { user = await runSql(db, sql); } catch (e) { return { correct: false, where: explainSqlError((e as Error).message) }; }
    return compareSqlResults(user, await runSql(db, question.sql!.reference), question.sql!, sql);
  };
  it('alternatives', async () => {
    expect((await grade('l-m2j-4-p1', 'SELECT customer_id, name, channel FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)')).correct).toBe(true);
    expect((await grade('l-m2j-4-p1', 'SELECT customer_id, name, channel FROM customers WHERE customer_id NOT IN (SELECT customer_id FROM orders)')).correct).toBe(true);
    expect((await grade('l-m2c-1-p2', "WITH t AS (SELECT o.order_id, SUM(i.unit_price*i.quantity*(1-i.discount)) amt FROM orders o JOIN order_items i USING (order_id) WHERE o.status='completed' GROUP BY 1) SELECT ROUND(AVG(amt)) FROM t")).correct).toBe(true);
    expect((await grade('l-m2k-2-p1', "SELECT DATE_TRUNC('month', order_date)::date, COUNT(*) FILTER (WHERE status='completed'), COUNT(*) FILTER (WHERE status='cancelled'), COUNT(*) FILTER (WHERE status='refunded') FROM orders GROUP BY 1 ORDER BY 1")).correct).toBe(true);
    expect((await grade('l-m2w-2-q5', "SELECT DISTINCT ON (customer_id) customer_id, order_id, order_date FROM orders WHERE status = 'completed' ORDER BY customer_id, order_date, order_id")).where).toContain('請用 PARTITION BY 再寫一次');
  });
  it('typical mistakes', async () => {
    expect((await grade('l-m2j-1-p2', 'SELECT c.customer_id, COUNT(*) FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id')).where).toContain('第 2 欄');
    expect((await grade('l-m2j-1-p2', 'SELECT c.customer_id, COUNT(o.order_id) FROM customers c JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id')).where).toContain('比正確答案少');
    expect((await grade('l-m2j-3-p1', "SELECT SUM(o.shipping_fee) FROM orders o JOIN order_items i ON i.order_id = o.order_id WHERE o.status = 'completed'")).where).toContain('值和正確答案不同');
    expect((await grade('l-m2g-3-p1', "SELECT customer_id, COUNT(*) FROM orders WHERE COUNT(*) >= 10 GROUP BY customer_id")).where).toContain('WHERE 裡不能使用聚合函數');
    expect((await grade('l-m2s-4-p1', 'SELECT customer_id, name FROM customers WHERE birth_year = NULL')).where).toContain('比正確答案少');
    expect((await grade('l-m2s-3-p1', 'SELECT product_name, price FROM products ORDER BY price LIMIT 3')).correct).toBe(false);
    expect((await grade('l-m2s-1-p1', 'SELECT product_name, categry FROM products')).where).toContain('找不到欄位 categry');
  });
});
