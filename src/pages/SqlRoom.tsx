import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SqlEditor } from '../components/SqlEditor';
import { CopyToAIButton } from '../components/CopyToAI';
import { PageHeader } from '../components/ui';
import { GUIDED_RULES, LEARNER_BACKGROUND } from '../core/aiPrompt';
import { SHOP_SCHEMA, REVENUE_NOTE } from '../content/shopSchema';
import type { SqlResult } from '../engines/sqlEngine';

const SAMPLES: [string, string][] = [
  ['各分類商品數', 'SELECT category, COUNT(*) AS products\nFROM products\nGROUP BY category;'],
  ['每月完成訂單數', "SELECT DATE_TRUNC('month', order_date)::date AS month, COUNT(*) AS orders\nFROM orders\nWHERE status = 'completed'\nGROUP BY 1\nORDER BY 1;"],
  ['各縣市營收', "SELECT c.city,\n       ROUND(SUM(i.unit_price * i.quantity * (1 - i.discount)), 0) AS revenue\nFROM orders o\nJOIN customers c   ON c.customer_id = o.customer_id\nJOIN order_items i ON i.order_id = o.order_id\nWHERE o.status = 'completed'\nGROUP BY c.city\nORDER BY revenue DESC;"],
];

const KEY = 'da180-sql-draft';

export function SqlRoomPage() {
  const [sql, setSql] = useState<string>(() => {
    try { return localStorage.getItem(KEY) ?? SAMPLES[0][1]; } catch { return SAMPLES[0][1]; }
  });
  const [last, setLast] = useState<SqlResult | null>(null);
  const update = (v: string) => {
    setSql(v);
    try { localStorage.setItem(KEY, v); } catch { /* 無法儲存草稿時忽略 */ }
  };

  const aiPrompt = () => [
    GUIDED_RULES,
    '',
    `【我的背景】${LEARNER_BACKGROUND}`,
    '',
    '【資料庫】PostgreSQL，資料表如下：',
    ...SHOP_SCHEMA.map((t) => `- ${t.table}(${t.columns.map((c) => c[0]).join(', ')})`),
    REVENUE_NOTE,
    '',
    '【我寫的查詢】',
    sql,
    '',
    last ? `【執行結果】共 ${last.rows.length} 列，欄位：${last.columns.join(', ')}` : '【執行結果】（尚未執行或出現錯誤）',
    '',
    '請先問我想用這個查詢回答什麼問題，再引導我檢查邏輯，不要直接幫我改寫。',
  ].join('\n');

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="SQL 練習室" subtitle="自由練習：在瀏覽器內的 PostgreSQL 執行任何查詢。資料會自動還原，怎麼寫都不會弄壞。" />
      <div className="card">
        <div className="mb-2 flex flex-wrap gap-2">
          <span className="text-xs text-muted">範例：</span>
          {SAMPLES.map(([label, q]) => (
            <button key={label} className="btn btn-ghost !px-2.5 !py-1 text-xs" onClick={() => update(q)}>{label}</button>
          ))}
        </div>
        <SqlEditor value={sql} onChange={update} onRunResult={setLast} />
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyToAIButton build={aiPrompt} label="請 AI 幫我檢查查詢" />
          <Link to="/lessons" className="btn btn-ghost">到課程中心做有批改的 SQL 練習</Link>
        </div>
        <p className="mt-2 text-xs text-muted">草稿會自動保存在這台裝置。</p>
      </div>
    </div>
  );
}
