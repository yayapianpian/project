import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAbilityReport } from '../hooks/data';
import { CONCEPTS } from '../content/concepts';
import { DOMAIN_LABEL, DOMAINS } from '../types/content';
import { Badge, Loading, PageHeader, ProgressBar, Stat } from '../components/ui';
import { ScoreTrend, SkillRadar } from '../components/Charts';

export function AbilitiesPage() {
  const ability = useAbilityReport();
  const snaps = useLiveQuery(() => db.skillSnapshots.orderBy('weekIndex').toArray(), []);
  if (!ability || !snaps) return <Loading />;
  const { report, masteries } = ability;
  const byId = new Map(masteries.map((m) => [m.conceptId, m]));

  return (
    <div>
      <PageHeader title="個人能力分析" subtitle="100 分制：資料處理 20、SQL 20、Python 15、Power BI 15、商業分析 20、專案表達 10。分數只依測驗與作品品質計算。" />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_180px]">
            <SkillRadar data={report.domains.map((d) => ({ label: DOMAIN_LABEL[d.domain], score: d.mastery === null ? null : d.score100 }))} />
            <Stat label="能力總分" value={`${report.total} / 100`} sub={report.totalGrade} />
          </div>
        </section>
        <section className="card">
          <h2 className="mb-1 text-sm font-semibold">成長曲線（每週總分）</h2>
          {snaps.length < 2 ? <p className="py-6 text-sm text-muted">累積兩週以上的紀錄後會顯示成長曲線。</p> : <ScoreTrend data={snaps.map((s) => ({ label: `第${s.weekIndex}週`, score: s.total }))} />}
        </section>

        <section className="card lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">各能力分數與分級</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-2 font-normal">能力</th><th className="font-normal">得分</th><th className="w-40 font-normal">0–100</th><th className="font-normal">分級</th><th className="font-normal">證據</th><th className="font-normal">概念涵蓋</th></tr></thead>
              <tbody>
                {report.domains.map((d) => (
                  <tr key={d.domain} className="border-t border-line align-top">
                    <td className="py-2.5 font-medium">{DOMAIN_LABEL[d.domain]}</td>
                    <td className="tabular-nums">{d.mastery === null ? '—' : `${d.points.toFixed(1)} / ${d.max}`}</td>
                    <td className="pr-4 pt-3.5"><ProgressBar value={d.score100} tone={d.score100 < 40 ? 'bad' : d.score100 < 60 ? 'warn' : 'good'} label={`${DOMAIN_LABEL[d.domain]} 分數`} /><span className="text-xs text-muted tabular-nums">{d.mastery === null ? '' : d.score100}</span></td>
                    <td>
                      {d.grade ? <Badge tone="accent">{d.grade}</Badge> : <Badge tone="muted">證據不足</Badge>}
                      {d.capNote && <div className="mt-1 text-xs text-muted">{d.capNote}</div>}
                    </td>
                    <td className="tabular-nums text-muted">{d.evidenceCount} 筆</td>
                    <td className="tabular-nums text-muted">{d.coveredConcepts} / {d.totalConcepts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">分級規則：0–39 初學者、40–59 基礎建立中、60–74 具備基礎實作能力、75–89 具備獨立分析能力（需限時測驗或專案證據）、90–100 具備良好實務能力（需進階專案證據）。一項能力少於 4 筆作答時顯示「證據不足」。</p>
        </section>

        <section className="card lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">概念熟練度</h2>
          {masteries.length === 0 && <p className="mb-3 text-sm text-muted">尚無作答紀錄。<Link to="/diagnostic" className="text-accent hover:underline">先做能力診斷</Link></p>}
          <div className="grid gap-5 md:grid-cols-2">
            {DOMAINS.map((dom) => (
              <div key={dom}>
                <h3 className="mb-2 text-sm font-medium">{DOMAIN_LABEL[dom]}</h3>
                <ul className="space-y-1.5">
                  {CONCEPTS.filter((c) => c.domain === dom).map((c) => {
                    const m = byId.get(c.id);
                    return (
                      <li key={c.id} className="grid grid-cols-[1fr_80px_64px] items-center gap-2 text-xs">
                        <span className="truncate" title={c.name}>{c.name}</span>
                        <ProgressBar value={m ? m.mastery * 100 : 0} tone={!m ? 'accent' : m.mastery < 0.4 ? 'bad' : m.mastery < 0.6 ? 'warn' : 'good'} label={`${c.name} 熟練度`} />
                        <span className="text-right text-muted tabular-nums">{m ? `${Math.round(m.mastery * 100)}%·${m.evidenceCount}筆` : '未測'}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
