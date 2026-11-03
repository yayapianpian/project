import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { regeneratePlan, todayISO } from '../db/repo';
import { useAbilityReport, usePlan, useProfile } from '../hooks/data';
import { MODULE_BY_ID, PHASES } from '../content/curriculum';
import { currentDayIndex } from '../core/planner';
import type { PlanDay } from '../types/user';
import { Badge, Loading, Modal, PageHeader, ProgressBar } from '../components/ui';
import { TaskRow } from './Dashboard';
import { Link } from 'react-router-dom';

function dayStatus(d: PlanDay, todayIdx: number): { label: string; tone: 'good' | 'warn' | 'accent' | 'muted' } {
  const done = d.tasks.filter((t) => t.status === 'done').length;
  if (done === d.tasks.length) return { label: '完成', tone: 'good' };
  if (d.dayIndex === todayIdx) return { label: '今天', tone: 'accent' };
  if (d.dayIndex < todayIdx) return { label: done > 0 ? '部分完成' : '未完成', tone: 'warn' };
  return { label: '尚未開始', tone: 'muted' };
}

export function RoadmapPage() {
  const profile = useProfile();
  const plan = usePlan();
  const ability = useAbilityReport();
  const [openPhase, setOpenPhase] = useState<number | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const todayIdx = profile ? currentDayIndex(profile.startDate, todayISO()) : 0;
  const byPhase = useMemo(() => {
    const map = new Map<number, PlanDay[]>();
    (plan ?? []).forEach((d) => map.set(d.phaseId, [...(map.get(d.phaseId) ?? []), d]));
    return map;
  }, [plan]);

  if (profile === undefined || plan === undefined) return <Loading />;
  if (!profile || plan.length === 0) {
    return <div className="card text-sm">尚未產生學習計畫。<Link to="/" className="ml-1 text-accent hover:underline">前往首頁開始</Link></div>;
  }
  const currentPhase = plan.find((d) => d.dayIndex === Math.min(Math.max(todayIdx, 1), plan.length))?.phaseId ?? 1;
  const activePhase = openPhase ?? currentPhase;

  return (
    <div>
      <PageHeader
        title="180 天學習路線"
        subtitle={`${plan[0].date} 開始 · ${plan[plan.length - 1].date} 結束 · 每週固定一個商業思維任務`}
        actions={<button className="btn btn-ghost" onClick={() => setConfirm(true)}><RotateCcw size={16} />依最新診斷重新產生計畫</button>}
      />
      <div className="space-y-3">
        {PHASES.map((p) => {
          const days = byPhase.get(p.id) ?? [];
          const tasks = days.flatMap((d) => d.tasks);
          const done = tasks.filter((t) => t.status === 'done').length;
          const open = activePhase === p.id;
          const modules = [...new Set(days.map((d) => d.moduleId))];
          return (
            <section key={p.id} className="card !p-0">
              <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpenPhase(open ? 0 : p.id)} aria-expanded={open}>
                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">第 {p.id} 個月：{p.title}</span>
                    {p.id === currentPhase && todayIdx >= 1 && <Badge>目前階段</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    第 {days[0]?.dayIndex}–{days[days.length - 1]?.dayIndex} 天 · {days.length} 天 · 實戰：{p.practice}
                  </div>
                </div>
                <div className="hidden w-40 sm:block">
                  <ProgressBar value={done} max={tasks.length} tone="good" label={`第 ${p.id} 個月完成度`} />
                  <div className="mt-1 text-right text-xs text-muted">{done} / {tasks.length}</div>
                </div>
              </button>
              {open && (
                <div className="space-y-4 border-t border-line p-4">
                  {modules.map((mid) => {
                    const m = MODULE_BY_ID[mid];
                    const mdays = days.filter((d) => d.moduleId === mid);
                    return (
                      <div key={mid}>
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{m.title}</span>
                          <Badge tone="muted">{mdays.length} 天</Badge>
                          {mdays[0].note && <Badge tone={mdays[0].note.includes('壓縮') ? 'good' : 'warn'}>{mdays[0].note.includes('壓縮') ? '已壓縮' : '已加強'}</Badge>}
                        </div>
                        <ul className="grid grid-cols-1 gap-1.5">
                          {mdays.map((d) => {
                            const st = dayStatus(d, todayIdx);
                            const isOpen = openDay === d.dayIndex;
                            return (
                              <li key={d.dayIndex} className={`rounded-lg border ${d.dayIndex === todayIdx ? 'border-accent' : 'border-line'}`}>
                                <button className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm" onClick={() => setOpenDay(isOpen ? null : d.dayIndex)} aria-expanded={isOpen}>
                                  <span className="w-16 shrink-0 text-xs text-muted tabular-nums">第 {d.dayIndex} 天</span>
                                  <span className="hidden w-24 shrink-0 text-xs text-muted sm:inline">{d.date}</span>
                                  <span className="min-w-0 flex-1 truncate">{d.tasks[0]?.title}</span>
                                  <Badge tone={st.tone}>{st.label}</Badge>
                                </button>
                                {isOpen && (
                                  <ul className="space-y-2 border-t border-line p-3">
                                    {d.tasks.map((t) => <TaskRow key={t.taskId} day={d} task={t} report={ability?.report} />)}
                                  </ul>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="重新產生計畫"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>取消</button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await regeneratePlan();
                setBusy(false);
                setConfirm(false);
              }}
            >
              確定重新產生
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed">會依照最新一次能力診斷與目前的設定（開始日、每日時間）重新安排 180 天。<strong>已完成的任務會保留</strong>，如果某個模組被壓縮或延長，對應天數的任務會重新分配。</p>
      </Modal>
    </div>
  );
}
