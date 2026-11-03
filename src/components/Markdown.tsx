import type { ReactNode } from 'react';

// 簡易 Markdown 轉 React（不使用 innerHTML，不會執行任何 HTML）

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<strong key={`${keyBase}-${i++}`}>{tok.slice(2, -2)}</strong>);
    else out.push(<code key={`${keyBase}-${i++}`} className="rounded bg-surface-2 px-1 py-0.5 text-[0.9em]">{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="my-3 overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 text-xs leading-relaxed sm:text-sm">{code.join('\n')}</pre>);
      continue;
    }
    if (line.startsWith('## ') || line.startsWith('### ')) {
      const h3 = line.startsWith('### ');
      const text = line.replace(/^#+\s/, '');
      blocks.push(h3 ? <h4 key={k++} className="mb-1 mt-4 text-sm font-semibold">{inline(text, `h${k}`)}</h4> : <h3 key={k++} className="mb-2 mt-5 text-base font-semibold">{inline(text, `h${k}`)}</h3>);
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={k++} className="my-3 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead><tr>{head.map((c, j) => <th key={j} className="border-b border-line px-2 py-1.5 text-left font-medium text-muted">{inline(c, `th${k}${j}`)}</th>)}</tr></thead>
            <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border-b border-line px-2 py-1.5 align-top">{inline(c, `td${k}${ri}${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items: string[] = [];
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) items.push(lines[i++].replace(/^(- |\d+\. )/, ''));
      const cls = 'my-2 space-y-1 pl-5 text-sm leading-relaxed';
      blocks.push(ordered
        ? <ol key={k++} className={`${cls} list-decimal`}>{items.map((t, j) => <li key={j}>{inline(t, `li${k}${j}`)}</li>)}</ol>
        : <ul key={k++} className={`${cls} list-disc`}>{items.map((t, j) => <li key={j}>{inline(t, `li${k}${j}`)}</li>)}</ul>);
      continue;
    }
    if (line.startsWith('> ')) {
      blocks.push(<blockquote key={k++} className="my-3 rounded-lg border-l-4 border-accent bg-accent-soft px-3 py-2 text-sm">{inline(line.slice(2), `q${k}`)}</blockquote>);
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(```|## |### |\||- |\d+\. |> )/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++} className="my-2 text-sm leading-relaxed">{inline(para.join(''), `p${k}`)}</p>);
  }
  return <div>{blocks}</div>;
}

/** 讓課程內容可以用多行字串撰寫 */
export const md = (...lines: string[]) => lines.join('\n');
