// tests/engine/func/questionnaire.test.ts
import { describe, it, expect } from 'vitest';
import {
  INDICATOR_KINDS, INDICATOR_STYLES, DIRECTION_KINDS, LICENSE_KINDS,
  likertIndicatorSchema, objectiveIndicatorSchema, indicatorSchema,
} from '../../../src/engine/func/questionnaire';

describe('constants', () => {
  it('INDICATOR_KINDS has both', () => {
    expect(INDICATOR_KINDS).toContain('likert');
    expect(INDICATOR_KINDS).toContain('objective');
  });
  it('LICENSE_KINDS includes study-developed', () => {
    expect(LICENSE_KINDS).toContain('study-developed');
  });
});

describe('likertIndicatorSchema', () => {
  it('parses valid PHQ-2-like indicator', () => {
    const parsed = likertIndicatorSchema.parse({
      kind: 'likert',
      id: 'psychological.depression',
      domain: 'psychological',
      label: '憂鬱篩檢',
      style: 'symptom',
      direction: 'higher_is_worse',
      weight: 1.0,
      license: 'public-domain',
      loincCode: '55757-9',
      maxScore: 3,
      questions: [
        { id: 'psychological.depression.q1', text: 'q1', options: [{ label: '無', score: 0 }] },
        { id: 'psychological.depression.q2', text: 'q2', options: [{ label: '無', score: 0 }] },
      ],
      minCompletionPolicy: 1.0,
      clinicalCutoff: {
        threshold: 3, comparator: '>=', flagLabel: 'positive-depression-screen',
        severity: 'advisory', citation: 'Kroenke 2003',
      },
    });
    expect(parsed.kind).toBe('likert');
  });

  it('rejects commercial license', () => {
    expect(() => likertIndicatorSchema.parse({
      kind: 'likert', id: 'x.y', domain: 'vitality', label: 'l',
      style: 'capacity', direction: 'higher_is_better', weight: 1, license: 'commercial',
      maxScore: 3, questions: [{ id: 'x.y.q1', text: 't', options: [] }],
    })).toThrow();
  });

  it('rejects maxScore > 10 (sane bound)', () => {
    expect(() => likertIndicatorSchema.parse({
      kind: 'likert', id: 'x.y', domain: 'vitality', label: 'l',
      style: 'capacity', direction: 'higher_is_better', weight: 1, license: 'public-domain',
      maxScore: 100, questions: [{ id: 'x.y.q1', text: 't', options: [] }],
    })).toThrow();
  });
});

describe('objectiveIndicatorSchema', () => {
  it('parses reaction-time test', () => {
    const parsed = objectiveIndicatorSchema.parse({
      kind: 'objective',
      id: 'cognition.processing_speed',
      domain: 'cognition',
      label: '處理速度',
      style: 'capacity',
      direction: 'higher_is_worse',
      weight: 1.0,
      license: 'research-open-noncommercial',
      test: {
        type: 'reaction-time',
        paradigm: 'simple-visual',
        trials: 20, warmupTrials: 5,
        validRangeMs: { min: 100, max: 2000 },
        norms: {
          '18-39': { mean: 350, std: 80, citation: 'NIH Toolbox' },
          '40-54': null,
          '55-64': null,
        },
      },
    });
    expect(parsed.test.type).toBe('reaction-time');
  });

  it('parses tmt-a test', () => {
    const parsed = objectiveIndicatorSchema.parse({
      kind: 'objective',
      id: 'cognition.executive_function',
      domain: 'cognition',
      label: 'TMT-A',
      style: 'capacity',
      direction: 'higher_is_worse',
      weight: 1.0,
      license: 'research-open-noncommercial',
      test: {
        type: 'tmt-a',
        targetCount: 25,
        administration: 'browser-mouse',
        norms: { '18-39': null, '40-54': null, '55-64': null },
      },
    });
    expect(parsed.test.type).toBe('tmt-a');
  });
});

describe('indicatorSchema (discriminated union)', () => {
  it('routes by kind', () => {
    const lik = indicatorSchema.parse({
      kind: 'likert', id: 'vitality.sleep_quality', domain: 'vitality',
      label: 's', style: 'capacity', direction: 'higher_is_better', weight: 1,
      license: 'public-domain', maxScore: 3,
      questions: [{ id: 'vitality.sleep_quality.q1', text: 't', options: [] }],
    });
    expect(lik.kind).toBe('likert');
  });
});

describe('tier 分層欄位', () => {
  it('指標層 tier 預設為 screener', () => {
    const parsed = indicatorSchema.parse({
      kind: 'likert', id: 'vitality.sleep_quality', domain: 'vitality',
      label: '睡眠', style: 'capacity', direction: 'higher_is_better',
      maxScore: 3, weight: 1.0, license: 'public-domain',
      questions: [{ id: 'vitality.sleep_quality.q1', text: 'x',
        options: [{ label: 'a', score: 0 }, { label: 'b', score: 3 }] }],
    });
    expect(parsed.kind === 'likert' && parsed.tier).toBe('screener');
  });

  it('題層 tier:detail 與 revealDetailWhen 可被解析', () => {
    const parsed = indicatorSchema.parse({
      kind: 'likert', id: 'vitality.fatigue', domain: 'vitality',
      label: '疲勞', style: 'symptom', direction: 'higher_is_worse',
      maxScore: 4, weight: 1.0, license: 'cc-by-nc-sa',
      revealDetailWhen: { screenerQuestionIds: ['vitality.fatigue.q1'], threshold: 2, comparator: '>=' },
      questions: [
        { id: 'vitality.fatigue.q1', text: 'x', options: [{ label: 'a', score: 0 }, { label: 'b', score: 4 }] },
        { id: 'vitality.fatigue.q2', text: 'y', tier: 'detail', options: [{ label: 'a', score: 0 }, { label: 'b', score: 4 }] },
      ],
    });
    expect(parsed.kind === 'likert' && parsed.questions[1].tier).toBe('detail');
    expect(parsed.kind === 'likert' && parsed.revealDetailWhen?.threshold).toBe(2);
  });
});
