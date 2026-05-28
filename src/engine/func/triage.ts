import type { IndicatorScore, DomainScore } from './scorer';
import type { ICDomain } from '../../lib/education/schemas';
import type { AgeGroupAdult } from '../../lib/utils/age-groups';

export type TriageCategory = 'normal' | 'observe' | 'consult' | 'incomplete';

export interface Recommendation {
  domain?: ICDomain;
  type: 'maintenance' | 'self-care' | 'in-depth-assessment' | 'consult-medical';
  message: string;
  suggestedSpecialties?: string[];
  triggerIndicators?: string[];
  evidenceFlags?: Array<'domain-low' | 'domain-moderate' | 'multi-domain-moderate' | 'clinical-cutoff'>;
}

export interface TriageResult {
  category: TriageCategory;
  confidence: number;
  summary: string;
  domainScores: DomainScore[];
  flaggedDomains: ICDomain[];
  clinicalCutoffs: Array<{
    indicatorId: string;
    subScaleId?: string;
    domain: ICDomain;
    flagLabel: string;
    severity: 'consult' | 'advisory';
  }>;
  recommendations: Recommendation[];
  incomplete: boolean;
  completedDomains: number;
  assessmentDate: string;
  ageGroup: AgeGroupAdult;
}

export function computeTriage(input: {
  indicatorScores: IndicatorScore[];
  domainScores: DomainScore[];
  applicableWeights: Record<string, number>;
  ageGroup: AgeGroupAdult;
  assessmentDate: string;
}): TriageResult {
  const { indicatorScores, domainScores, ageGroup, assessmentDate } = input;

  // Collect cutoffs (indicator-level + sub-scale-level). Prefer the human-readable
  // flagLabel from the indicator schema (e.g. 'positive-depression-screen') and
  // fall back to a synthesized `{id}-cutoff` when the schema didn't define one.
  const clinicalCutoffs: TriageResult['clinicalCutoffs'] = [];
  for (const ind of indicatorScores) {
    if (ind.cutoffFlag && ind.cutoffSeverity) {
      clinicalCutoffs.push({
        indicatorId: ind.indicatorId,
        domain: ind.domain,
        flagLabel: ind.cutoffFlagLabel ?? `${ind.indicatorId}-cutoff`,
        severity: ind.cutoffSeverity,
      });
    }
    if (ind.subScaleScores) {
      for (const sub of ind.subScaleScores) {
        if (sub.cutoffFlag && sub.cutoffSeverity) {
          clinicalCutoffs.push({
            indicatorId: ind.indicatorId,
            subScaleId: sub.subScaleId,
            domain: ind.domain,
            flagLabel: sub.cutoffFlagLabel ?? `${sub.subScaleId}-cutoff`,
            severity: sub.cutoffSeverity,
          });
        }
      }
    }
  }

  const consultCutoff = clinicalCutoffs.some(c => c.severity === 'consult');
  const advisoryCutoff = clinicalCutoffs.some(c => c.severity === 'advisory');

  const completedDomains = domainScores.length;
  const allHigh = domainScores.every(d => d.band === 'high');
  const moderateCount = domainScores.filter(d => d.band === 'moderate').length;
  const lowCount = domainScores.filter(d => d.band === 'low').length;

  let category: TriageCategory;
  if (consultCutoff) {
    category = 'consult';
  } else if (completedDomains < 3) {
    category = 'incomplete';
  } else if (allHigh && !advisoryCutoff) {
    category = 'normal';
  } else if (lowCount >= 1 || moderateCount >= 2) {
    category = 'consult';
  } else if (moderateCount === 1 || (allHigh && advisoryCutoff)) {
    category = 'observe';
  } else {
    category = 'observe';
  }

  const flaggedDomains = domainScores.filter(d => d.band !== 'high').map(d => d.domain);
  const incomplete = category === 'incomplete';

  const confidence = computeConfidence(category, flaggedDomains.length, clinicalCutoffs.filter(c => c.severity === 'advisory').length, completedDomains);
  const summary = makeSummary(category, completedDomains);
  const recommendations = makeRecommendations(category, domainScores, indicatorScores, clinicalCutoffs);

  return {
    category, confidence, summary,
    domainScores, flaggedDomains, clinicalCutoffs, recommendations,
    incomplete, completedDomains, assessmentDate, ageGroup,
  };
}

function computeConfidence(
  category: TriageCategory, flagged: number, advisoryCutoff: number, completed: number,
): number {
  switch (category) {
    case 'incomplete': return Math.min(0.7, 0.3 + 0.1 * completed);
    case 'normal':     return Math.min(0.95, 0.7 + 0.05 * completed);
    case 'observe':    return Math.min(0.85, 0.6 + 0.05 * flagged + 0.05 * advisoryCutoff);
    case 'consult':    return Math.min(0.95, 0.7 + 0.05 * flagged + 0.05 * advisoryCutoff);
  }
}

function makeSummary(category: TriageCategory, completedDomains: number): string {
  switch (category) {
    case 'normal': return '整體功能維持在良好範圍。';
    case 'observe': return '部分面向有待觀察，建議自我管理並追蹤。';
    case 'consult': return '功能評估結果建議找醫師討論。';
    case 'incomplete': return `已測 ${completedDomains}/5 個面向，建議完成評估再看整體結果。`;
  }
}

function makeRecommendations(
  category: TriageCategory,
  domainScores: DomainScore[],
  indicatorScores: IndicatorScore[],
  cutoffs: TriageResult['clinicalCutoffs'],
): Recommendation[] {
  const recs: Recommendation[] = [];
  // 此處 stub — 完整對照表於 Task 1.7 recommendations.ts 落實
  return recs;
}
