import { useState } from 'react';
import { GUIDED_RULES, LEARNER_BACKGROUND } from '../core/aiPrompt';
import { DOMAIN_LABEL, DOMAINS, type Domain } from '../types/content';
import { useAbilityReport } from '../hooks/data';
import { PageHeader } from '../components/ui';
import { CopyToAIButton } from '../components/CopyToAI';

export function TutorPage() {
  const ability = useAbilityReport();
  const [domain, setDomain] = useState<Domain>('sql');
  const [question, setQuestion] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const build = () => {
    const d = ability?.report.domains.find((x) => x.domain === domain);
    const level = d?.enoughEvidence ? `${d.score100} 分（${d.grade}）` : '證據不足（尚未測驗）';
    return [
      GUIDED_RULES,
      '',
      `【我的背景】${LEARNER_BACKGROUND}我目前「${DOMAIN_LABEL[domain]}」的能力評估為：${level}。`,
      '',
      `【我的問題】${question.trim() || '（請先問我想問什麼）'}`,
      code.trim() ? `\n【我的程式碼／公式】\n${code.trim()}` : '',
      error.trim() ? `\n【執行結果或錯誤訊息】\n${error.trim()}` : '',
    ].filter(Boolean).join('\n');
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="AI 導師" subtitle="先引導思考、再給提示、最後才給完整解答。" />

      <section className="card mb-4">
        <h2 className="mb-2 text-sm font-semibold">目前狀態</h2>
        <ul className="space-y-1.5 text-sm">
          <li><span className="font-medium text-good">可使用：</span>「複製給 AI」——把問題整理好，貼到你自己的 Claude 或 ChatGPT。使用你現有的訂閱，不需要 API、不會額外付費。</li>
          <li><span className="font-medium text-muted">尚未啟用：</span>網站內直接對話的 AI 導師（需自備 API Key，另外付費，第 6 階段提供，屬於選用功能）。平台不會假裝有 AI 回覆。</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-4 text-sm font-semibold">整理問題，複製給 AI</h2>
        <div className="grid gap-4">
          <div>
            <label className="label" htmlFor="t-domain">問題屬於哪個能力</label>
            <select id="t-domain" className="input max-w-xs" value={domain} onChange={(e) => setDomain(e.target.value as Domain)}>
              {DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_LABEL[d]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-q">你的問題</label>
            <textarea id="t-q" className="input h-24" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="例如：為什麼我用 LEFT JOIN 之後，訂單數變多了？" />
          </div>
          <div>
            <label className="label" htmlFor="t-code">程式碼或公式（選填）</label>
            <textarea id="t-code" className="input h-28 font-mono text-xs" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SELECT ..." />
          </div>
          <div>
            <label className="label" htmlFor="t-err">執行結果或錯誤訊息（選填）</label>
            <textarea id="t-err" className="input h-20 font-mono text-xs" value={error} onChange={(e) => setError(e.target.value)} />
          </div>
          <div><CopyToAIButton build={build} label="產生提示並複製給 AI" /></div>
        </div>
      </section>
    </div>
  );
}
