// tests/engine/func/recommendations.test.ts
import { describe, it, expect } from 'vitest';
import { recommendationsFor } from '../../../src/engine/func/recommendations';

describe('recommendationsFor', () => {
  it('vitality low → 家醫科+營養師', () => {
    const r = recommendationsFor('consult', [
      { domain: 'vitality', score: 30, band: 'low', contributingIndicators: 1, missingIndicators: [] },
    ], [], []);
    const vit = r.find(x => x.domain === 'vitality');
    expect(vit?.type).toBe('consult-medical');
    expect(vit?.suggestedSpecialties).toContain('家庭醫學科');
  });

  it('cognition low → 神經內科+精神科', () => {
    const r = recommendationsFor('consult', [
      { domain: 'cognition', score: 35, band: 'low', contributingIndicators: 1, missingIndicators: [] },
    ], [], []);
    const cog = r.find(x => x.domain === 'cognition');
    expect(cog?.suggestedSpecialties).toContain('神經內科');
    expect(cog?.suggestedSpecialties).toContain('精神科');
  });

  it('PHQ-2 advisory cutoff → in-depth-assessment 提示 PHQ-9', () => {
    const r = recommendationsFor('observe', [], [], [
      { indicatorId: 'psychological.depression', domain: 'psychological',
        flagLabel: 'positive-depression-screen', severity: 'advisory' },
    ]);
    const phq = r.find(x => x.triggerIndicators?.includes('psychological.depression'));
    expect(phq?.type).toBe('in-depth-assessment');
  });
});
