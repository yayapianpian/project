import { MODULES, WEEKLY_BUSINESS_PROMPTS } from '../content/curriculum';
import type { CurriculumModule, Domain } from '../types/content';
import type { PlanDay, PlanTask } from '../types/user';

// 個人化 180 天計畫產生器（docs/02-features.md B2、D）

export const PLAN_DAYS = 180;

export interface PlannedModule {
  module: CurriculumModule;
  days: number;
  /** 依診斷結果調整的方式 */
  adjust: 'compressed' | 'extended' | 'normal';
}

function domainLevel(m: number | undefined): number {
  return m === undefined ? 0.5 : m;
}

function factorFor(m: number | undefined): number {
  if (m === undefined) return 1;
  if (m >= 0.75) return 0.5;
  if (m >= 0.6) return 0.75;
  if (m < 0.4) return 1.25;
  return 1;
}

/** 依各能力熟練度調整每個模組的天數，總天數固定 180 */
export function allocateModuleDays(
  domainMastery: Partial<Record<Domain, number>>,
  modules: CurriculumModule[] = MODULES,
  total = PLAN_DAYS,
): PlannedModule[] {
  const planned: PlannedModule[] = modules.map((module) => {
    if (module.kind !== 'learn') return { module, days: module.baseDays, adjust: 'normal' };
    const f = factorFor(domainMastery[module.domain]);
    const days = Math.max(1, Math.round(module.baseDays * f));
    return { module, days, adjust: f < 1 ? 'compressed' : f > 1 ? 'extended' : 'normal' };
  });

  let diff = total - planned.reduce((s, p) => s + p.days, 0);
  const order = (desc: boolean) =>
    planned
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.module.kind === 'learn')
      .sort((a, b) => {
        const d = domainLevel(domainMastery[a.p.module.domain]) - domainLevel(domainMastery[b.p.module.domain]);
        return (desc ? -d : d) || a.i - b.i;
      })
      .map(({ p }) => p);

  if (diff > 0) {
    // 省下的天數分配給較弱的能力；若都不弱，分配給產業專案（作品集）
    let candidates = order(false).filter((p) => domainLevel(domainMastery[p.module.domain]) < 0.6);
    if (candidates.length === 0) candidates = planned.filter((p) => p.module.kind === 'project' && p.module.phase === 5);
    for (let i = 0; diff > 0; i++, diff--) {
      const p = candidates[i % candidates.length];
      p.days += 1;
      if (p.adjust === 'normal') p.adjust = 'extended';
    }
  } else if (diff < 0) {
    const candidates = order(true);
    let guard = 0;
    for (let i = 0; diff < 0 && guard < 10000; i++, guard++) {
      const p = candidates[i % candidates.length];
      if (p.days > 1) {
        p.days -= 1;
        diff++;
      }
    }
  }
  return planned;
}

export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** 將主題平均分配到模組的每一天 */
export function topicsForDay(module: CurriculumModule, dayInModule: number, days: number): string[] {
  const t = module.topics.length;
  if (days >= t) {
    return dayInModule < t ? [module.topics[dayInModule]] : [`綜合練習與複習：${module.title}`];
  }
  const start = Math.floor((dayInModule * t) / days);
  const end = Math.floor(((dayInModule + 1) * t) / days);
  return module.topics.slice(start, end);
}

export function generatePlan(opts: {
  startDate: string;
  dailyMinutes: number;
  domainMastery: Partial<Record<Domain, number>>;
}): PlanDay[] {
  const { startDate, dailyMinutes, domainMastery } = opts;
  const planned = allocateModuleDays(domainMastery);
  const days: PlanDay[] = [];
  let dayIndex = 1;
  let businessIdx = 0;

  for (const { module, days: n, adjust } of planned) {
    for (let j = 0; j < n; j++, dayIndex++) {
      const topics = topicsForDay(module, j, n);
      const topicText = topics.join('、');
      const tasks: PlanTask[] = [];
      const id = (type: string, k = 0) => `${module.id}:${type}:${j}:${k}`;
      const isLast = j === n - 1;

      if (module.kind === 'learn') {
        const prefix = adjust === 'compressed' ? '快速複習' : '學習';
        tasks.push({ taskId: id('lesson'), type: 'lesson', moduleId: module.id, title: `${prefix}：${topicText}`, estMinutes: Math.round(dailyMinutes * 0.5), status: 'todo' });
        tasks.push({ taskId: id('practice'), type: 'practice', moduleId: module.id, title: `練習：${topicText}`, estMinutes: Math.round(dailyMinutes * 0.35), status: 'todo' });
        if (isLast) {
          tasks.push({
            taskId: id('quiz'),
            type: 'quiz',
            moduleId: module.id,
            title: adjust === 'compressed' ? `免修測驗：${module.title}` : `單元測驗：${module.title}`,
            estMinutes: Math.round(dailyMinutes * 0.15),
            status: 'todo',
          });
        }
      } else if (module.kind === 'project') {
        tasks.push({ taskId: id('project'), type: 'project', moduleId: module.id, title: `專案：${topicText}`, estMinutes: dailyMinutes, status: 'todo' });
      } else {
        tasks.push({ taskId: id('interview'), type: 'interview', moduleId: module.id, title: topicText, estMinutes: dailyMinutes, status: 'todo' });
      }

      if (dayIndex % 7 === 0) {
        tasks.push({
          taskId: `business:${dayIndex / 7}`,
          type: 'business',
          moduleId: module.id,
          title: WEEKLY_BUSINESS_PROMPTS[businessIdx++ % WEEKLY_BUSINESS_PROMPTS.length],
          estMinutes: 20,
          status: 'todo',
        });
      }

      let note: string | undefined;
      if (j === 0 && adjust === 'compressed') note = '依診斷結果壓縮：快速複習後以測驗確認';
      if (j === 0 && adjust === 'extended') note = '依診斷結果加強：增加練習天數';

      days.push({
        dayIndex,
        date: addDays(startDate, dayIndex - 1),
        phaseId: module.phase,
        moduleId: module.id,
        tasks,
        note,
      });
    }
  }
  return days;
}

/** 重新產生計畫時，保留已完成任務的狀態（以 taskId 對應） */
export function carryOverStatus(oldDays: PlanDay[], newDays: PlanDay[]): PlanDay[] {
  const status = new Map<string, PlanTask>();
  oldDays.forEach((d) => d.tasks.forEach((t) => t.status !== 'todo' && status.set(t.taskId, t)));
  return newDays.map((d) => ({
    ...d,
    tasks: d.tasks.map((t) => {
      const old = status.get(t.taskId);
      return old ? { ...t, status: old.status, completedAt: old.completedAt } : t;
    }),
  }));
}

/** 今天是計畫的第幾天（1 起算；開始日之前回傳 0） */
export function currentDayIndex(startDate: string, today: string): number {
  const ms = Date.parse(today + 'T00:00:00Z') - Date.parse(startDate + 'T00:00:00Z');
  return Math.floor(ms / 86400000) + 1;
}
