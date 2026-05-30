import type { IndicatorScore, SubScaleScore } from './scorer';
import type { TriageResult } from './triage';
import type { ICDomain } from '../../lib/education/schemas';

const DOMAIN_ORDER: ICDomain[] = ['vitality', 'locomotion', 'cognition', 'psychological', 'sensory'];

const DOMAIN_LABELS: Record<ICDomain, string> = {
  vitality: '身體活力',
  locomotion: '行動功能',
  cognition: '認知功能',
  psychological: '心理功能',
  sensory: '感官功能',
};

export interface RadarAxis {
  domain: ICDomain;
  label: string;
  score: number | null;
  band: 'high' | 'moderate' | 'low' | null;
  capacityScore?: number;
  symptomScore?: number;
  indicators: Array<{
    id: string;
    label: string;
    score: number;
    cutoffFlag?: boolean;
    cutoffSeverity?: 'consult' | 'advisory';
    subScaleScores?: SubScaleScore[];
  }>;
}

export interface RadarData {
  axes: RadarAxis[];
  bandThresholds: { moderate: 40; high: 70 };
  meta: {
    triageCategory: TriageResult['category'];
    incomplete: boolean;
    completedDomains: number;
    totalDomains: 5;
    assessmentDate: string;
    ageGroup: TriageResult['ageGroup'];
  };
}

export function buildRadarData(
  triage: TriageResult,
  indicatorScores: IndicatorScore[],
  indicatorLabels: Record<string, string> = {},
): RadarData {
  const domainMap = new Map(triage.domainScores.map(d => [d.domain, d]));

  const axes: RadarAxis[] = DOMAIN_ORDER.map(domain => {
    const d = domainMap.get(domain);
    const indicators = indicatorScores
      .filter(s => s.domain === domain)
      .map(s => ({
        id: s.indicatorId,
        label: indicatorLabels[s.indicatorId] ?? s.indicatorId,
        score: s.score,
        cutoffFlag: s.cutoffFlag,
        cutoffSeverity: s.cutoffSeverity,
        subScaleScores: s.subScaleScores,
      }));

    if (!d) {
      return {
        domain, label: DOMAIN_LABELS[domain],
        score: null, band: null,
        indicators,
      };
    }
    return {
      domain, label: DOMAIN_LABELS[domain],
      score: d.score, band: d.band,
      capacityScore: d.capacityScore,
      symptomScore: d.symptomScore,
      indicators,
    };
  });

  return {
    axes,
    bandThresholds: { moderate: 40, high: 70 },
    meta: {
      triageCategory: triage.category,
      incomplete: triage.incomplete,
      completedDomains: triage.completedDomains,
      totalDomains: 5,
      assessmentDate: triage.assessmentDate,
      ageGroup: triage.ageGroup,
    },
  };
}
