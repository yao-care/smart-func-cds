// tests/engine/func/triage.test.ts
import { describe, it, expect } from 'vitest';
import { computeTriage, type TriageResult, type TriageCategory } from '../../../src/engine/func/triage';
import type { IndicatorScore, DomainScore } from '../../../src/engine/func/scorer';

const mkDomain = (domain: any, score: number, band: 'high'|'moderate'|'low'): DomainScore => ({
  domain, score, band, contributingIndicators: 1, missingIndicators: [],
});

const mkIndicator = (id: string, domain: any, opts: Partial<IndicatorScore> = {}): IndicatorScore => ({
  indicatorId: id, domain, style: 'symptom', kind: 'likert', score: 50, ...opts,
});

describe('computeTriage — 主規則', () => {
  it('all high, no cutoff → normal', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: [
        mkDomain('vitality', 80, 'high'),
        mkDomain('locomotion', 85, 'high'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 78, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('normal');
  });

  it('1 moderate, no cutoff → observe', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: [
        mkDomain('vitality', 50, 'moderate'),
        mkDomain('locomotion', 80, 'high'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 78, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('observe');
  });

  it('2 moderate → consult', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: [
        mkDomain('vitality', 50, 'moderate'),
        mkDomain('locomotion', 55, 'moderate'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 78, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('consult');
  });

  it('1 low → consult', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: [
        mkDomain('vitality', 30, 'low'),
        mkDomain('locomotion', 80, 'high'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 78, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('consult');
  });

  it('< 3 domains completed → incomplete, summary reports completed count not flagged count', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: [
        mkDomain('vitality', 80, 'high'),
        mkDomain('locomotion', 80, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('incomplete');
    expect(r.summary).toContain('2/5');
  });

  it('advisory cutoff + all high → observe, preserves schema flagLabel', () => {
    const r = computeTriage({
      indicatorScores: [
        mkIndicator('psychological.depression', 'psychological', {
          score: 75, cutoffFlag: true, cutoffSeverity: 'advisory',
          cutoffFlagLabel: 'positive-depression-screen',
        }),
      ],
      domainScores: [
        mkDomain('vitality', 80, 'high'),
        mkDomain('locomotion', 80, 'high'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 75, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('observe');
    expect(r.clinicalCutoffs.length).toBe(1);
    expect(r.clinicalCutoffs[0].flagLabel).toBe('positive-depression-screen');
  });

  it('cutoff without cutoffFlagLabel falls back to synthesized {id}-cutoff', () => {
    const r = computeTriage({
      indicatorScores: [
        mkIndicator('psychological.stress', 'psychological', {
          cutoffFlag: true, cutoffSeverity: 'advisory',
        }),
      ],
      domainScores: [
        mkDomain('vitality', 80, 'high'),
        mkDomain('locomotion', 80, 'high'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 75, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.clinicalCutoffs[0].flagLabel).toBe('psychological.stress-cutoff');
  });

  it('consult cutoff overrides incomplete', () => {
    const r = computeTriage({
      indicatorScores: [
        mkIndicator('psychological.depression', 'psychological', {
          cutoffFlag: true, cutoffSeverity: 'consult',
        }),
      ],
      domainScores: [
        mkDomain('vitality', 80, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('consult');
  });
});

describe('computeTriage — confidence', () => {
  it('normal 5/5 → high confidence', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: ['vitality','locomotion','cognition','psychological','sensory'].map(d =>
        mkDomain(d, 80, 'high')
      ),
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
  });
});
