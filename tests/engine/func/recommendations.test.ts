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
});

describe('recommendations 自適應後', () => {
  it('depression advisory cutoff 文案反映憂鬱篩檢（非 S2）', () => {
    const recs = recommendationsFor('observe', [], [], [
      { indicatorId: 'psychological.depression', domain: 'psychological', severity: 'advisory', flagLabel: 'positive-depression-screen' },
    ]);
    const r = recs.find(x => x.triggerIndicators?.includes('psychological.depression'));
    expect(r).toBeTruthy();
    expect(r!.message).not.toContain('S2');
  });

  it('不再為已移除的 burnout 產生建議', () => {
    const recs = recommendationsFor('observe', [], [], [
      { indicatorId: 'psychological.burnout', domain: 'psychological', severity: 'advisory', flagLabel: 'x' },
    ]);
    expect(recs).toEqual([]);
  });

  it('self_harm（consult cutoff）產生明確緊急建議', () => {
    const recs = recommendationsFor('consult', [], [], [
      { indicatorId: 'psychological.self_harm', domain: 'psychological', severity: 'consult', flagLabel: 'self-harm-ideation' },
    ]);
    const r = recs.find(x => x.triggerIndicators?.includes('psychological.self_harm'));
    expect(r).toBeTruthy();
    expect(r!.type).toBe('consult-medical');
    expect(r!.message).toContain('1925');
  });

  it('anxiety advisory cutoff 文案反映焦慮篩檢（非 S2，含 GAD-7）', () => {
    const recs = recommendationsFor('observe', [], [], [
      { indicatorId: 'psychological.anxiety', domain: 'psychological', severity: 'advisory', flagLabel: 'positive-anxiety-screen' },
    ]);
    const r = recs.find(x => x.triggerIndicators?.includes('psychological.anxiety'));
    expect(r).toBeTruthy();
    expect(r!.message).not.toContain('S2');
    expect(r!.message).toContain('GAD-7');
  });
});
