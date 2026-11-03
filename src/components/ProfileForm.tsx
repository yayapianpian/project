import { useState } from 'react';
import { DIAGNOSTIC_DOMAINS } from '../core/diagnostic';
import { saveProfile, todayISO } from '../db/repo';
import { DOMAIN_LABEL, type Domain } from '../types/content';
import type { Profile } from '../types/user';

export const TARGET_ROLES = ['電商／零售數據分析師', '金融／投資數據分析師', '行銷數據分析師', '製造／物流數據分析師', '尚未決定'];

const SELF_REPORT_TEXT: Record<Domain, string> = {
  data: '用過試算表做資料清理或樞紐分析表',
  sql: '寫過 SELECT / GROUP BY / JOIN 查詢',
  python: '用過 Pandas 處理資料',
  powerbi: '用過 Power BI 做過報表',
  business: '做過商業分析（例如 RFM 會員分群）',
  communication: '',
};

export function ProfileForm({ initial, submitLabel, onSaved }: { initial?: Profile | null; submitLabel: string; onSaved?: (p: Profile) => void }) {
  const [displayName, setName] = useState(initial?.displayName ?? '');
  const [startDate, setStart] = useState(initial?.startDate ?? todayISO());
  const [dailyMinutes, setMinutes] = useState(initial?.dailyMinutes ?? 120);
  const [targetRole, setRole] = useState(initial?.targetRole ?? TARGET_ROLES[0]);
  const [selfReport, setSelf] = useState<Partial<Record<Domain, boolean>>>(
    initial?.selfReport ?? { powerbi: true, business: true, data: true },
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const p = await saveProfile({ displayName: displayName.trim() || '學員', startDate, dailyMinutes, targetRole, selfReport });
    setSaving(false);
    setSaved(true);
    onSaved?.(p);
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="pf-name">怎麼稱呼你</label>
        <input id="pf-name" className="input" value={displayName} onChange={(e) => setName(e.target.value)} placeholder="例如：小安" />
      </div>
      <div>
        <label className="label" htmlFor="pf-start">計畫第 1 天</label>
        <input id="pf-start" type="date" className="input" value={startDate} onChange={(e) => setStart(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="pf-min">每天學習時間</label>
        <select id="pf-min" className="input" value={dailyMinutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {[60, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{m} 分鐘</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="pf-role">目標職缺</label>
        <select id="pf-role" className="input" value={targetRole} onChange={(e) => setRole(e.target.value)}>
          {TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="label">你已經做過哪些事？（只用來決定診斷題的起始難度，不會直接加分）</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {DIAGNOSTIC_DOMAINS.map((d) => (
            <label key={d} className="flex items-start gap-2 rounded-lg border border-line p-2.5 text-sm">
              <input type="checkbox" className="mt-0.5" checked={!!selfReport[d]} onChange={(e) => setSelf({ ...selfReport, [d]: e.target.checked })} />
              <span><span className="font-medium">{DOMAIN_LABEL[d]}</span>：{SELF_REPORT_TEXT[d]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn btn-primary" disabled={saving}>{saving ? '儲存中…' : submitLabel}</button>
        {saved && initial && <span className="text-sm text-good">已儲存</span>}
      </div>
    </form>
  );
}
