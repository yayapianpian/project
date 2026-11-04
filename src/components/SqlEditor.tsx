import { useRef, useState } from 'react';
import { Database, Play, RotateCcw } from 'lucide-react';
import { explainSqlError, getShopDb, runSql, type SqlResult } from '../engines/sqlEngine';
import { REVENUE_NOTE, SHOP_SCHEMA } from '../content/shopSchema';

const TOKENS = ['SELECT', 'FROM', 'WHERE', 'AND', 'GROUP BY', 'HAVING', 'ORDER BY', 'DESC', 'LIMIT', 'JOIN', 'LEFT JOIN', 'ON', 'AS', 'COUNT(', 'SUM(', 'AVG(', 'DISTINCT', 'CASE WHEN', 'THEN', 'ELSE', 'END', 'WITH', 'OVER (', 'PARTITION BY', '*', ',', '(', ')', "'", '=', '<', '>', '.', '_', ';'];

export function ResultTable({ result, max = 50 }: { result: SqlResult; max?: number }) {
  return (
    <div className="mt-2">
      <div className="mb-1 text-xs text-muted">共 {result.rows.length} 列 · {result.ms} ms{result.rows.length > max ? `（只顯示前 ${max} 列）` : ''}</div>
      {result.columns.length === 0 ? (
        <p className="text-sm text-muted">查詢已執行，沒有回傳資料。</p>
      ) : (
        <div className="max-h-72 overflow-auto rounded-lg border border-line">
          <table className="w-full min-w-max text-xs">
            <thead className="sticky top-0 bg-surface-2"><tr>{result.columns.map((c, i) => <th key={i} className="px-2 py-1.5 text-left font-medium">{c}</th>)}</tr></thead>
            <tbody>
              {result.rows.slice(0, max).map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((v, j) => <td key={j} className="whitespace-pre px-2 py-1 font-mono tabular-nums">{v === null ? <span className="text-muted">NULL</span> : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SchemaPanel() {
  return (
    <details className="rounded-lg border border-line p-2 text-xs">
      <summary className="cursor-pointer select-none font-medium"><Database size={13} className="mr-1 inline" />資料表結構：好日子線上商城</summary>
      <p className="mt-2 text-muted">{REVENUE_NOTE}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {SHOP_SCHEMA.map((t) => (
          <div key={t.table}>
            <div className="font-mono font-semibold">{t.table} <span className="font-sans font-normal text-muted">{t.desc}</span></div>
            <ul className="mt-1 space-y-0.5">
              {t.columns.map(([c, type, d]) => <li key={c}><span className="font-mono">{c}</span> <span className="text-muted">{type} · {d}</span></li>)}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

/** SQL 編輯器：可在手機上用按鈕輸入常用關鍵字與符號，「執行」只預覽結果，不計分 */
export function SqlEditor({ value, onChange, disabled, onRunResult }: { value: string; onChange: (v: string) => void; disabled?: boolean; onRunResult?: (r: SqlResult | null) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'running'>('idle');

  const insert = (tok: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const word = /^[A-Z]/.test(tok);
    const text = (word && before && !/\s$/.test(before) ? ' ' : '') + tok + (word && !tok.endsWith('(') ? ' ' : '');
    const next = before + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  };

  const run = async () => {
    if (!value.trim()) return;
    setError(null);
    setStatus('loading');
    try {
      const db = await getShopDb();
      setStatus('running');
      const r = await runSql(db, value);
      setResult(r);
      onRunResult?.(r);
    } catch (e) {
      setResult(null);
      setError(explainSqlError((e as Error).message));
      onRunResult?.(null);
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <textarea
        ref={ref}
        className="input h-36 font-mono text-[13px] leading-relaxed"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            run();
          }
        }}
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        placeholder="在這裡寫 SQL，例如：SELECT * FROM orders LIMIT 10;"
        aria-label="SQL 查詢"
      />
      {!disabled && (
        <div className="flex gap-1 overflow-x-auto pb-1" aria-label="快速輸入">
          {TOKENS.map((t) => (
            <button key={t} type="button" className="shrink-0 rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-xs" onClick={() => insert(t)}>{t}</button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={run} disabled={status !== 'idle' || !value.trim()}>
          <Play size={14} />{status === 'loading' ? '載入 SQL 引擎…' : status === 'running' ? '執行中…' : '執行（預覽結果）'}
        </button>
        {!disabled && value && <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={() => { onChange(''); setResult(null); setError(null); }}><RotateCcw size={14} />清除</button>}
        <span className="text-xs text-muted">電腦可按 Ctrl+Enter 執行</span>
      </div>
      {status === 'loading' && <p className="text-xs text-muted">第一次使用會下載瀏覽器版 PostgreSQL（約 5～8 MB，建議在 Wi-Fi 下），之後瀏覽器會快取，速度會快很多。</p>}
      {error && <p className="rounded-lg bg-bad-soft p-2 text-sm">{error}</p>}
      {result && <ResultTable result={result} />}
      <SchemaPanel />
    </div>
  );
}
