import { MODULE_BY_ID, PHASES } from '../content/curriculum';
import { DOMAIN_LABEL } from '../types/content';
import type { PlanTask } from '../types/user';
import { buildBusinessPrompt, buildTopicPrompt } from './aiPrompt';
import type { AbilityReport } from './scoring';

export function promptForTask(task: PlanTask, report?: AbilityReport): string {
  if (task.type === 'business') return buildBusinessPrompt(task.title);
  const m = MODULE_BY_ID[task.moduleId];
  const phase = PHASES.find((p) => p.id === m?.phase);
  const d = report?.domains.find((x) => x.domain === m?.domain);
  return buildTopicPrompt({
    phaseTitle: phase?.title ?? '',
    moduleTitle: m?.title ?? '',
    topic: task.title,
    domainLabel: m ? DOMAIN_LABEL[m.domain] : undefined,
    domainGrade: d?.enoughEvidence ? `${d.score100} 分（${d.grade}）` : null,
  });
}
