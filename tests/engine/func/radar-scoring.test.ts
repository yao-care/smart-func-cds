import { describe, it, expect } from 'vitest';
import { buildRadarData } from '../../../src/engine/func/radar-scoring';
import type { TriageResult } from '../../../src/engine/func/triage';

const mkTriage = (partial: Partial<TriageResult>): TriageResult => ({
  category: 'normal', confidence: 0.9, summary: '',
  domainScores: [], flaggedDomains: [], clinicalCutoffs: [],
  recommendations: [], incomplete: false, completedDomains: 5,
  assessmentDate: '2026-05-28', ageGroup: '18-39',
  ...partial,
});

describe('buildRadarData', () => {
  it('5 軸固定順序', () => {
    const r = buildRadarData(mkTriage({
      domainScores: [
        { domain: 'sensory', score: 80, band: 'high', contributingIndicators: 1, missingIndicators: [] },
        { domain: 'vitality', score: 70, band: 'high', contributingIndicators: 1, missingIndicators: [] },
      ],
    }), []);
    expect(r.axes.map(a => a.domain)).toEqual(['vitality', 'locomotion', 'cognition', 'psychological', 'sensory']);
  });

  it('未測 domain → score: null + band: null', () => {
    const r = buildRadarData(mkTriage({
      domainScores: [
        { domain: 'vitality', score: 70, band: 'high', contributingIndicators: 1, missingIndicators: [] },
      ],
    }), []);
    const loco = r.axes.find(a => a.domain === 'locomotion');
    expect(loco?.score).toBeNull();
    expect(loco?.band).toBeNull();
  });

  it('bandThresholds 固定 40/70', () => {
    const r = buildRadarData(mkTriage({}), []);
    expect(r.bandThresholds).toEqual({ moderate: 40, high: 70 });
  });
});
