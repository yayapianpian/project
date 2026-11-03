import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Play, Target, TrendingUp } from 'lucide-react';
import { db } from '../db/db';
import { regeneratePlan, setTaskStatus, todayISO } from '../db/repo';
import { useAbilityReport, usePlan, useProfile, useQuizHistory } from '../hooks/data';
import { MODULE_BY_ID, PHASES } from '../content/curriculum';
import { CONCEPT_BY_ID } from '../content/concepts';
import { currentDayIndex, PLAN_DAYS } from '../core/planner';
import { promptForTask } from '../core/taskPrompt';
import { buildTopicPrompt } from '../core/aiPrompt';
import { lessonsForTask } from '../content/lessons';
import { DOMAIN_LABEL } from '../types/content';
import type { PlanDay, PlanTask } from '../types/user';
import { Badge, Loading, PageHeader, ProgressBar, Stat } from '../components/ui';
import { CopyToAIButton } from '../components/CopyToAI';
import { ProfileForm } from '../components/ProfileForm';
import { ScoreTrend, SkillRadar } from '../components/Charts';
import type { AbilityReport } from '../core/scoring';

const TASK_TYPE_LABEL: Record<PlanTask['type'], string> = {
  lesson: '學習', practice: '練習', quiz: '測驗', project: '專案', review: '複習', interview: '求職', business: '商業思維', remediation: '補強',
};

export function TaskRow({ day, task, report }: { day: PlanDay; task: PlanTask; report?: AbilityReport }) {
  const saved = task.status === 'done';
  // 先更新畫面，資料庫寫入完成後再以實際資料為準
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  useEffect(() => setOptimistic(null), [saved]);
  const done = optimistic ?? saved;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center">
      <label className="flex flex-1 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[var(--accent)]"
          checked={done}
          onChange={(e) => {
            setOptimistic(e.target.checked);
            setTaskStatus(day.dayIndex, task.taskId, e.target.checked ? 'done' : 'todo');
          }}
          aria-label={`標記「${task.title}」為${done ? '未完成' : '已完成'}`}
        />
        <span className="min-w-0">
          <span className={`block text-sm ${done ? 'text-muted line-through' : ''}`}>{task.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Badge tone={task.type === 'business' ? 'warn' : task.type === 'quiz' ? 'good' : 'muted'}>{TASK_TYPE_LABEL[task.type]}</Badge>
            約 {task.estMinutes} 分鐘
          </span>
        </span>
      </label>
      <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">
        {lessonsForTask(task)[0] && (
          <Link to={`/lessons/${lessonsForTask(task)[0].id}${task.type === 'practice' ? '#practice' : ''}`} className="btn btn-primary !px-3 !py-1 text-xs">開始</Link>
        )}
        <CopyToAIButton compact build={() => promptForTask(task, report)} label={task.type === 'business' ? '請 AI 當主管' : '用 AI 學習'} />
      </div>
    </li>
  );
}

function Welcome() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="歡迎來到 Data Analyst 180" subtitle="180 天，從現在的程度走到能應徵初階數據分析師。先花 1 分鐘設定，再做一次能力診斷。" />
      <div className="card">
        <h2 className="mb-4 text-base font-semibold">基本設定</h2>
        <ProfileForm submitLabel="儲存並繼續" />
      </div>
      <p className="mt-4 text-xs text-muted">所有資料只存在這台電腦的瀏覽器中，不會上傳。可在「設定與備份」匯出備份檔。</p>
    </div>
  );
}

function StartDiagnostic({ name }: { name: string }) {
  const active = useLiveQuery(() => db.quizSessions.where('status').equals('in_progress').filter((s) => s.mode === 'diagnostic').first(), []);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`${name}，先做能力診斷`} subtitle="診斷結果會決定你的 180 天計畫：已經會的內容可以壓縮、較弱的能力會增加練習天數。" />
      <div className="card">
        <ol className="mb-5 space-y-2 text-sm">
          <li>• 約 30 題、40 分鐘，涵蓋資料處理、SQL、Python、Power BI、商業分析。</li>
          <li>• 自適應出題：答對會變難、答錯會變簡單，不用擔心一開始就很難。</li>
          <li>• 診斷中不顯示對錯，結束後每一題都有詳細解析。</li>
          <li>• 中途關閉或重新整理，下次會從同一題接續。</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Link to="/diagnostic" className="btn btn-primary"><Play size={16} />{active ? `繼續診斷（已答 ${active.questionIds.length} 題）` : '開始能力診斷'}</Link>
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await regeneratePlan();
              setBusy(false);
            }}
          >
            先略過，使用標準計畫
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">略過的話會先使用未個人化的標準計畫，之後可在「測驗中心」補做診斷並重新產生計畫。</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const profile = useProfile();
  const plan = usePlan();
  const ability = useAbilityReport();
  const history = useQuizHistory();
  const today = todayISO();

  const view = useMemo(() => {
    if (!profile || !plan || plan.length === 0) return null;
    const idx = currentDayIndex(profile.startDate, today);
    const dayIdx = Math.min(Math.max(idx, 1), plan.length);
    const todayDay = plan.find((d) => d.dayIndex === dayIdx)!;
    const pastDays = plan.filter((d) => d.dayIndex <= Math.max(idx, 0));
    const pastTasks = pastDays.flatMap((d) => d.tasks);
    const pastDone = pastTasks.filter((t) => t.status === 'done').length;
    const allTasks = plan.flatMap((d) => d.tasks);
    const allDone = allTasks.filter((t) => t.status === 'done').length;
    const behind = pastDays.filter((d) => d.dayIndex < idx).flatMap((d) => d.tasks).filter((t) => t.status === 'todo').length;
    const weekStart = Math.floor((dayIdx - 1) / 7) * 7 + 1;
    const weekDays = plan.filter((d) => d.dayIndex >= weekStart && d.dayIndex < weekStart + 7);
    const weekModules = [...new Set(weekDays.map((d) => d.moduleId))].map((id) => MODULE_BY_ID[id]).filter(Boolean);
    const weekTasks = weekDays.flatMap((d) => d.tasks);
    let next: { day: PlanDay; task: PlanTask } | null = null;
    for (const d of plan) {
      const t = d.tasks.find((x) => x.status === 'todo');
      if (t) {
        next = { day: d, task: t };
        break;
      }
    }
    return { idx, dayIdx, todayDay, pastTasks, pastDone, allTasks, allDone, behind, weekStart, weekModules, weekTasks, next };
  }, [profile, plan, today]);

  if (profile === undefined || plan === undefined || ability === undefined) return <Loading />;
  if (profile === null) return <Welcome />;
  if (!view) return <StartDiagnostic name={profile.displayName} />;

  const { report, masteries } = ability;
  const phase = PHASES.find((p) => p.id === view.todayDay.phaseId)!;
  const notStarted = view.idx < 1;
  const finished = view.idx > PLAN_DAYS;
  const weak = masteries.filter((m) => m.mastery < 0.6).sort((a, b) => a.mastery - b.mastery).slice(0, 5);
  const trend = (history ?? []).map((s, i) => ({ label: s.mode === 'diagnostic' ? `診斷${i + 1}` : `#${i + 1}`, score: s.score ?? 0 })).slice(-10);
  const avg = trend.length ? Math.round(trend.reduce((s, t) => s + t.score, 0) / trend.length) : null;

  return (
    <div>
      <PageHeader
        title={`${profile.displayName}，${notStarted ? '準備開始' : finished ? '180 天完成了' : `今天是第 ${view.idx} 天`}`}
        subtitle={notStarted ? `計畫將在 ${profile.startDate} 開始，下面先預覽第 1 天的任務。` : `第 ${phase.id} 個月：${phase.title}　·　目標職缺：${profile.targetRole}`}
        actions={<Link to="/roadmap" className="btn btn-ghost">查看完整路線 <ArrowRight size={16} /></Link>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 180 天進度 */}
        <section className="card lg:col-span-2" aria-labelledby="h-progress">
          <h2 id="h-progress" className="mb-4 flex items-center gap-2 text-sm font-semibold"><TrendingUp size={16} />180 天進度</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="計畫天數" value={`${Math.max(0, Math.min(view.idx, PLAN_DAYS))} / ${PLAN_DAYS}`} sub={`第 ${phase.id} 階段`} />
            <Stat label="已完成任務" value={`${view.allDone}`} sub={`全部 ${view.allTasks.length} 項`} />
            <Stat label="到今天的完成率" value={view.pastTasks.length ? `${Math.round((view.pastDone / view.pastTasks.length) * 100)}%` : '—'} />
            <Stat label="落後任務" value={<span className={view.behind > 0 ? 'text-warn' : ''}>{view.behind}</span>} sub={view.behind > 0 ? '前幾天未完成' : '進度正常'} />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-muted"><span>時間進度</span><span>{Math.round((Math.max(0, Math.min(view.idx, PLAN_DAYS)) / PLAN_DAYS) * 100)}%</span></div>
            <ProgressBar value={Math.max(0, Math.min(view.idx, PLAN_DAYS))} max={PLAN_DAYS} label="時間進度" />
            <div className="flex justify-between text-xs text-muted"><span>任務完成</span><span>{Math.round((view.allDone / Math.max(1, view.allTasks.length)) * 100)}%</span></div>
            <ProgressBar value={view.allDone} max={view.allTasks.length} tone="good" label="任務完成" />
          </div>
        </section>

        {/* 下一個任務 */}
        <section className="card flex flex-col" aria-labelledby="h-next">
          <h2 id="h-next" className="mb-3 flex items-center gap-2 text-sm font-semibold"><Target size={16} />下一個學習任務</h2>
          {view.next ? (
            <>
              <div className="text-xs text-muted">第 {view.next.day.dayIndex} 天 · {MODULE_BY_ID[view.next.task.moduleId]?.title}</div>
              <div className="mt-1 flex-1 text-base font-medium">{view.next.task.title}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={() => setTaskStatus(view.next!.day.dayIndex, view.next!.task.taskId, 'done')}>
                  <CheckCircle2 size={16} />完成這項
                </button>
                <CopyToAIButton build={() => promptForTask(view.next!.task, report)} label="用 AI 學習" />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">所有任務都完成了！</p>
          )}
        </section>

        {/* 今日任務 */}
        <section className="card lg:col-span-2" aria-labelledby="h-today">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="h-today" className="flex items-center gap-2 text-sm font-semibold"><ClipboardList size={16} />{notStarted ? '第 1 天任務（預覽）' : `今日任務 · 第 ${view.dayIdx} 天`}</h2>
            <span className="text-xs text-muted">{view.todayDay.tasks.filter((t) => t.status === 'done').length} / {view.todayDay.tasks.length} 完成</span>
          </div>
          {view.todayDay.note && <p className="mb-2 text-xs text-accent">{view.todayDay.note}</p>}
          <ul className="space-y-2">
            {view.todayDay.tasks.map((t) => <TaskRow key={t.taskId} day={view.todayDay} task={t} report={report} />)}
          </ul>
          <p className="mt-3 text-xs text-muted">
            有「開始」按鈕的任務可以直接進入課程單元；尚未上線的主題請先用「用 AI 學習」貼到你自己的 Claude 或 ChatGPT。完成單元時任務會自動打勾。勾選完成只記錄進度，<strong>不會增加能力分數</strong>，能力分數只來自測驗與作品。
          </p>
        </section>

        {/* 本週目標 */}
        <section className="card" aria-labelledby="h-week">
          <h2 id="h-week" className="mb-3 text-sm font-semibold">本週目標（第 {view.weekStart}–{view.weekStart + 6} 天）</h2>
          <ul className="space-y-2 text-sm">
            {view.weekModules.map((m) => <li key={m.id} className="flex gap-2"><span className="text-accent">•</span>{m.title}</li>)}
          </ul>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted"><span>本週任務</span><span>{view.weekTasks.filter((t) => t.status === 'done').length} / {view.weekTasks.length}</span></div>
            <ProgressBar value={view.weekTasks.filter((t) => t.status === 'done').length} max={view.weekTasks.length} tone="good" label="本週任務完成" />
          </div>
        </section>

        {/* 技能雷達 */}
        <section className="card lg:col-span-2" aria-labelledby="h-radar">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="h-radar" className="text-sm font-semibold">技能熟練度</h2>
            <Link to="/abilities" className="text-xs text-accent hover:underline">完整能力分析 →</Link>
          </div>
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_200px]">
            <SkillRadar data={report.domains.map((d) => ({ label: DOMAIN_LABEL[d.domain], score: d.mastery === null ? null : d.score100 }))} />
            <div>
              <Stat label="能力總分（100 分制）" value={report.total} sub={report.totalGrade} />
              <table className="mt-3 w-full text-xs">
                <caption className="sr-only">各項能力分數</caption>
                <tbody>
                  {report.domains.map((d) => (
                    <tr key={d.domain} className="border-t border-line">
                      <th scope="row" className="py-1 text-left font-normal text-muted">{DOMAIN_LABEL[d.domain]}</th>
                      <td className="py-1 text-right tabular-nums">{d.mastery === null ? '未測' : `${d.points.toFixed(1)} / ${d.max}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 成績統計 */}
        <section className="card" aria-labelledby="h-scores">
          <h2 id="h-scores" className="mb-1 text-sm font-semibold">測驗成績</h2>
          {trend.length === 0 ? (
            <p className="py-6 text-sm text-muted">還沒有測驗紀錄。<Link to="/quiz" className="text-accent hover:underline">去測驗中心</Link></p>
          ) : (
            <>
              <div className="mb-1 text-xs text-muted">平均 {avg} 分 · 共 {trend.length} 次</div>
              <ScoreTrend data={trend} />
            </>
          )}
        </section>

        {/* 弱項分析 */}
        <section className="card lg:col-span-2" aria-labelledby="h-weak">
          <h2 id="h-weak" className="mb-3 flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} />弱項分析</h2>
          {weak.length === 0 ? (
            <p className="text-sm text-muted">{masteries.length === 0 ? '完成能力診斷或測驗後，這裡會列出需要加強的概念。' : '目前沒有熟練度低於 60% 的概念。'}</p>
          ) : (
            <ul className="space-y-2">
              {weak.map((m) => {
                const c = CONCEPT_BY_ID[m.conceptId];
                return (
                  <li key={m.conceptId} className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{c?.name ?? m.conceptId}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                        <span className="w-24"><ProgressBar value={m.mastery * 100} tone={m.mastery < 0.4 ? 'bad' : 'warn'} label={`${c?.name} 熟練度`} /></span>
                        {Math.round(m.mastery * 100)}% · {DOMAIN_LABEL[m.domain]} · {m.evidenceCount} 筆作答{m.evidenceCount < 4 && '（證據不足）'}
                      </div>
                    </div>
                    <CopyToAIButton
                      compact
                      label="用 AI 補強"
                      build={() => buildTopicPrompt({ phaseTitle: '弱點補強', moduleTitle: DOMAIN_LABEL[m.domain], topic: c?.name ?? m.conceptId, domainLabel: DOMAIN_LABEL[m.domain], domainGrade: `此概念熟練度 ${Math.round(m.mastery * 100)}%` })}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">第 4 階段會加入自動補強：同一概念連錯 3 次，系統會在隔天插入補強任務並暫時鎖住下一章。</p>
        </section>

        {/* 已完成專案 */}
        <section className="card" aria-labelledby="h-proj">
          <h2 id="h-proj" className="mb-3 text-sm font-semibold">已完成專案</h2>
          <Stat label="已結案作品" value="0" sub="產業模擬專案將於第 5 階段開放" />
        </section>
      </div>
    </div>
  );
}
