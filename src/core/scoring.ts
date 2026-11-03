import { CONCEPT_BY_ID } from '../content/concepts';
import { DOMAINS, DOMAIN_MAX, type Domain } from '../types/content';
import type { Attempt, ConceptMastery } from '../types/user';

// 100 分制能力評估（docs/04-scoring.md 第 2、4、5 節）

export interface GradeBand {
  min: number;
  label: string;
}

export const GRADE_BANDS: GradeBand[] = [
  { min: 90, label: '具備良好實務能力' },
  { min: 75, label: '具備獨立分析能力' },
  { min: 60, label: '具備基礎實作能力' },
  { min: 40, label: '基礎建立中' },
  { min: 0, label: '初學者' },
];

export function gradeLabel(score100: number): string {
  return GRADE_BANDS.find((b) => score100 >= b.min)!.label;
}

export interface DomainScore {
  domain: Domain;
  /** 0–1；沒有任何證據時為 null */
  mastery: number | null;
  /** mastery × 滿分 */
  points: number;
  max: number;
  /** 換算為 0–100 */
  score100: number;
  evidenceCount: number;
  /** 證據是否足夠顯示分級 */
  enoughEvidence: boolean;
  /** 已套用解鎖條件後的分級 */
  grade: string | null;
  /** 為什麼分級被限制 */
  capNote?: string;
  coveredConcepts: number;
  totalConcepts: number;
}

export interface AbilityReport {
  total: number;
  totalGrade: string;
  domains: DomainScore[];
}

const MIN_DOMAIN_EVIDENCE = 4;

/** 分級解鎖條件：≥75 需要限時測驗或專案證據；≥90 需要專案證據 */
function applyCaps(score100: number, attempts: Attempt[]): { grade: string; capNote?: string } {
  const hasTimedOrProject = attempts.some((a) => a.context === 'exam' || a.context === 'project');
  const hasProject = attempts.some((a) => a.context === 'project');
  if (score100 >= 90 && !hasProject) {
    if (!hasTimedOrProject) {
      return { grade: GRADE_BANDS[2].label, capNote: '完成一次限時測驗或專案可解鎖更高分級' };
    }
    return { grade: GRADE_BANDS[1].label, capNote: '通過一個進階產業專案可解鎖「具備良好實務能力」' };
  }
  if (score100 >= 75 && !hasTimedOrProject) {
    return { grade: GRADE_BANDS[2].label, capNote: '完成一次限時測驗或專案可解鎖「具備獨立分析能力」' };
  }
  return { grade: gradeLabel(score100) };
}

export function computeAbilityReport(masteries: ConceptMastery[], attempts: Attempt[]): AbilityReport {
  const totalConceptsByDomain = new Map<Domain, number>();
  Object.values(CONCEPT_BY_ID).forEach((c) =>
    totalConceptsByDomain.set(c.domain, (totalConceptsByDomain.get(c.domain) ?? 0) + 1),
  );

  const domains: DomainScore[] = DOMAINS.map((domain) => {
    const list = masteries.filter((m) => m.domain === domain);
    const domainAttempts = attempts.filter((a) => a.domain === domain);
    let num = 0;
    let den = 0;
    for (const m of list) {
      const importance = CONCEPT_BY_ID[m.conceptId]?.importance ?? 1;
      num += m.mastery * importance;
      den += importance;
    }
    const mastery = den > 0 ? num / den : null;
    const score100 = mastery === null ? 0 : Math.round(mastery * 100);
    const evidenceCount = domainAttempts.length;
    const enoughEvidence = evidenceCount >= MIN_DOMAIN_EVIDENCE;
    const caps = enoughEvidence ? applyCaps(score100, domainAttempts) : null;
    return {
      domain,
      mastery,
      points: mastery === null ? 0 : mastery * DOMAIN_MAX[domain],
      max: DOMAIN_MAX[domain],
      score100,
      evidenceCount,
      enoughEvidence,
      grade: caps?.grade ?? null,
      capNote: caps?.capNote,
      coveredConcepts: list.length,
      totalConcepts: totalConceptsByDomain.get(domain) ?? 0,
    };
  });

  const total = Math.round(domains.reduce((s, d) => s + d.points, 0));
  return { total, totalGrade: gradeLabel(total), domains };
}
