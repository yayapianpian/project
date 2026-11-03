import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play } from 'lucide-react';
import { db } from '../db/db';
import { useQuizHistory } from '../hooks/data';
import { gradeLabel } from '../core/scoring';
import { Badge, Loading, PageHeader } from '../components/ui';

const UPCOMING = [
  ['單元小測與階段測驗', '單選、多選、填空、SQL 實作、Python 程式、資料分析、商業情境題'],
  ['限時模擬考', '例如 60 分鐘企業數據分析筆試，倒數結束自動交卷'],
  ['弱點測驗', '只出熟練度較低的概念'],
  ['錯題重練', '錯題本＋間隔複習（1、3、7、21 天）'],
];

const MODE_LABEL: Record<string, string> = { diagnostic: '能力診斷', unit: '單元小測', phase: '階段測驗', weakness: '弱點測驗', mistakes: '錯題重練', mock_exam: '限時模擬考' };

export function QuizPage() {
  const history = useQuizHistory();
  const active = useLiveQuery(async () => (await db.quizSessions.where('status').equals('in_progress').filter((s) => s.mode === 'diagnostic').first()) ?? null, []);
  if (history === undefined || active === undefined) return <Loading />;
  const hasDiag = history.some((s) => s.mode === 'diagnostic');

  return (
    <div>
      <PageHeader title="測驗中心" subtitle="測驗與作品是能力分數唯一的來源；看課程、勾選任務都不會加分。" />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold">能力診斷</h2>
          <p className="mb-4 text-sm text-muted">30 題自適應診斷，結果會用來調整你的 180 天計畫。建議每個月結束時重新診斷一次，追蹤成長。</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/diagnostic" className="btn btn-primary"><Play size={16} />{active ? `繼續診斷（已答 ${active.questionIds.length} 題）` : hasDiag ? '查看結果／重新診斷' : '開始能力診斷'}</Link>
          </div>
        </section>
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold">第 4 階段將加入</h2>
          <ul className="space-y-2 text-sm">
            {UPCOMING.map(([t, d]) => <li key={t}><div className="font-medium">{t}</div><div className="text-xs text-muted">{d}</div></li>)}
          </ul>
        </section>
        <section className="card lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">測驗紀錄</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted">還沒有完成的測驗。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="py-2 font-normal">日期</th><th className="font-normal">類型</th><th className="font-normal">題數</th><th className="text-right font-normal">分數</th><th className="text-right font-normal">評級</th></tr></thead>
                <tbody>
                  {[...history].reverse().map((s) => (
                    <tr key={s.id} className="border-t border-line">
                      <td className="py-2">{s.endedAt ? new Date(s.endedAt).toLocaleDateString('zh-TW') : '—'}</td>
                      <td><Badge tone="muted">{MODE_LABEL[s.mode] ?? s.mode}</Badge></td>
                      <td className="tabular-nums">{s.questionIds.length}</td>
                      <td className="text-right font-medium tabular-nums">{s.score ?? '—'}</td>
                      <td className="text-right text-xs text-muted">{s.score !== undefined ? gradeLabel(s.score) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
