import { describe, it, expect, vi } from 'vitest';
import { deriveFuncTriggers } from '../../../src/lib/education/trigger-derivation';
import type { TriageResult } from '../../../src/engine/func/triage';
import type { DomainScore } from '../../../src/engine/func/scorer';
import type { ICDomain } from '../../../src/lib/education/schemas';

function ds(domain: ICDomain, band: DomainScore['band'], score: number): DomainScore {
  return {
    domain, score, band,
    contributingIndicators: 1,
    missingIndicators: [],
  };
}

function makeTriage(category: TriageResult['category'], domainScores: DomainScore[]): TriageResult {
  return {
    category,
    confidence: 0.8,
    summary: 'test',
    domainScores,
    flaggedDomains: domainScores.filter(d => d.band !== 'high').map(d => d.domain),
    clinicalCutoffs: [],
    recommendations: [],
    incomplete: category === 'incomplete',
    completedDomains: domainScores.length,
    assessmentDate: '2026-05-30',
    ageGroup: '18-39',
  };
}

describe('deriveFuncTriggers', () => {
  it('returns triage trigger for consult', () => {
    expect(deriveFuncTriggers(makeTriage('consult', []), '18-39')).toEqual([
      'func.triage.consult.18-39',
    ]);
  });

  it('skips triage when normal', () => {
    expect(deriveFuncTriggers(makeTriage('normal', [ds('vitality', 'high', 90)]), '18-39')).toEqual([]);
  });

  it('emits both triage + domain triggers using the domain band', () => {
    const triggers = deriveFuncTriggers(
      makeTriage('observe', [ds('vitality', 'high', 90), ds('cognition', 'moderate', 55)]),
      '40-54',
    );
    expect(triggers).toContain('func.triage.observe.40-54');
    expect(triggers).toContain('func.domain.cognition.moderate.40-54');
    // high-band domains do not emit a domain trigger
    expect(triggers).not.toContain('func.domain.vitality.high.40-54');
  });

  it('emits low-band trigger for a low domain', () => {
    const triggers = deriveFuncTriggers(
      makeTriage('consult', [ds('psychological', 'low', 20)]),
      '55-64',
    );
    expect(triggers).toContain('func.domain.psychological.low.55-64');
  });

  it('throws on unknown domain in DEV mode', () => {
    vi.stubEnv('DEV', true);
    const bad = makeTriage('observe', [ds('unknown_domain' as ICDomain, 'low', 10)]);
    expect(() => deriveFuncTriggers(bad, '18-39')).toThrow(/Unknown IC domain/);
    vi.unstubAllEnvs();
  });

  it('warns and skips unknown domain in prod mode', () => {
    vi.stubEnv('DEV', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const triggers = deriveFuncTriggers(
      makeTriage('observe', [ds('unknown_domain' as ICDomain, 'low', 10), ds('vitality', 'low', 10)]),
      '18-39',
    );
    expect(triggers).not.toContain('func.domain.unknown_domain.low.18-39');
    expect(triggers).toContain('func.domain.vitality.low.18-39');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unknown domain'));
    warn.mockRestore();
    vi.unstubAllEnvs();
  });
});
