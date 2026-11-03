import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { lessonFor, LESSONS } from '../content/lessons';
import type { LessonProgressRow } from '../db/repo';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { MODULES, PHASES } from '../content/curriculum';
import { CONCEPT_BY_ID } from '../content/concepts';
import { buildTopicPrompt } from '../core/aiPrompt';
import { DOMAIN_LABEL } from '../types/content';
import { useAbilityReport } from '../hooks/data';
import { Badge, PageHeader } from '../components/ui';
import { CopyToAIButton } from '../components/CopyToAI';

const KIND_LABEL = { learn: '教學', project: '實戰專案', job: '求職' } as const;

export function LessonsPage() {
  const [open, setOpen] = useState<string | null>(MODULES[0].id);
  const ability = useAbilityReport();
  const progress = useLiveQuery(async () => new Map(((await db.lessonProgress.toArray()) as LessonProgressRow[]).map((p) => [p.lessonId, p])), []);
  const done = progress ? [...progress.values()].filter((p) => p.status === 'passed').length : 0;
  return (
    <div>
      <PageHeader
        title="課程教學中心"
        subtitle={`六個月、44 個模組。目前已上線 ${LESSONS.length} 個完整單元（教學、範例、練習題、解答、常見錯誤、小測），已通過 ${done} 個；其他單元陸續上線。`}
      />
      <div className="card mb-4 border-accent bg-accent-soft text-sm">
        <strong>尚未上線的單元可以這樣學：</strong>每個主題旁邊的「用 AI 學習」會產生一段完整的提示文字（包含你的背景、目前能力與「先引導、再提示、最後才給答案」的規則），貼到你自己的 Claude 或 ChatGPT 就能開始，不需要額外付費。
      </div>
      {PHASES.map((p) => (
        <section key={p.id} className="mb-6">
          <h2 className="mb-2 text-base font-semibold">第 {p.id} 個月：{p.title}</h2>
          <div className="space-y-2">
            {MODULES.filter((m) => m.phase === p.id).map((m) => {
              const isOpen = open === m.id;
              const d = ability?.report.domains.find((x) => x.domain === m.domain);
              return (
                <div key={m.id} className="card !p-0">
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen}>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    <span className="min-w-0 flex-1 text-sm font-medium">{m.title}</span>
                    <Badge tone="muted">{KIND_LABEL[m.kind]}</Badge>
                    <Badge tone="muted">{DOMAIN_LABEL[m.domain]}</Badge>
                  </button>
                  {isOpen && (
                    <div className="border-t border-line px-4 py-3">
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {m.concepts.map((c) => <Badge key={c} tone="accent">{CONCEPT_BY_ID[c]?.name}</Badge>)}
                      </div>
                      <ol className="space-y-2">
                        {m.topics.map((t, i) => {
                          const l = lessonFor(m.id, i);
                          const pr = l && progress?.get(l.id);
                          return (
                          <li key={t} className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center">
                            <span className="flex-1 text-sm">
                              <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>{t}
                              {pr && <span className="ml-2"><Badge tone={pr.status === 'passed' ? 'good' : 'accent'}>{pr.status === 'passed' ? `通過 ${pr.bestQuizScore}` : pr.status === 'practiced' ? '已練習' : '已讀'}</Badge></span>}
                            </span>
                            {l ? <Link to={`/lessons/${l.id}`} className="btn btn-primary !px-3 !py-1 text-xs">{pr ? '繼續' : '開始學習'}</Link> : (
                            <CopyToAIButton
                              compact
                              label="用 AI 學習"
                              build={() => buildTopicPrompt({ phaseTitle: p.title, moduleTitle: m.title, topic: t, domainLabel: DOMAIN_LABEL[m.domain], domainGrade: d?.enoughEvidence ? `${d.score100} 分（${d.grade}）` : null })}
                            />)}
                          </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
