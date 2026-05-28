// tests/engine/func/scorer.test.ts
import { describe, it, expect } from 'vitest';
import type { LikertIndicator } from '../../../src/engine/func/questionnaire';
import { scoreLikertIndicator } from '../../../src/engine/func/scorer';

const PHQ2: LikertIndicator = {
  kind: 'likert', id: 'psychological.depression', domain: 'psychological',
  label: 'PHQ-2', style: 'symptom', direction: 'higher_is_worse',
  weight: 1.0, license: 'public-domain', loincCode: '55757-9',
  maxScore: 3,
  questions: [
    { id: 'psychological.depression.q1', text: 'q1', options: [] },
    { id: 'psychological.depression.q2', text: 'q2', options: [] },
  ],
  minCompletionPolicy: 1.0,
  clinicalCutoff: {
    threshold: 3, comparator: '>=', flagLabel: 'positive-depression-screen',
    severity: 'advisory', citation: 'Kroenke 2003',
  },
};

const BAT12: LikertIndicator = {
  kind: 'likert', id: 'psychological.burnout', domain: 'psychological',
  label: 'BAT-12', style: 'symptom', direction: 'higher_is_worse',
  weight: 1.0, license: 'cc-by-nc-sa',
  maxScore: 5, minScore: 1,
  questions: Array.from({ length: 12 }, (_, i) => ({
    id: `psychological.burnout.q${i + 1}`, text: `q${i + 1}`, options: [],
  })),
  minCompletionPolicy: 1.0,
  subScales: [
    { id: 'bat12.exhaustion', label: 'exhaustion',
      questionIds: ['psychological.burnout.q1','psychological.burnout.q2','psychological.burnout.q3'],
      clinicalCutoff: { threshold: 2.96, comparator: '>=', flagLabel: 'bat12-exhaustion-redzone', severity: 'advisory', citation: 'Schaufeli 2020' },
    },
    { id: 'bat12.mental_distance', label: 'mental_distance',
      questionIds: ['psychological.burnout.q4','psychological.burnout.q5','psychological.burnout.q6'] },
    { id: 'bat12.cognitive_impairment', label: 'cognitive_impairment',
      questionIds: ['psychological.burnout.q7','psychological.burnout.q8','psychological.burnout.q9'] },
    { id: 'bat12.emotional_impairment', label: 'emotional_impairment',
      questionIds: ['psychological.burnout.q10','psychological.burnout.q11','psychological.burnout.q12'] },
  ],
};

const PSS4: LikertIndicator = {
  kind: 'likert', id: 'psychological.stress', domain: 'psychological',
  label: 'PSS-4', style: 'symptom', direction: 'higher_is_worse',
  weight: 1.0, license: 'research-open-noncommercial',
  maxScore: 4,
  questions: [
    { id: 'psychological.stress.q1', text: 'q1', reverseScored: false, options: [] },
    { id: 'psychological.stress.q2', text: 'q2', reverseScored: true, options: [] },
    { id: 'psychological.stress.q3', text: 'q3', reverseScored: true, options: [] },
    { id: 'psychological.stress.q4', text: 'q4', reverseScored: false, options: [] },
  ],
  minCompletionPolicy: 1.0,
  clinicalCutoff: {
    threshold: 9, comparator: '>=', flagLabel: 'positive-stress-screen',
    severity: 'advisory', citation: 'Cohen 1988 + Warttig 2013',
  },
};

describe('scoreLikertIndicator — BAT-12 (CRITICAL: 1-5 Likert 公式驗算)', () => {
  it('全答 1（最佳 capacity）→ score 100', () => {
    const ans = Object.fromEntries(BAT12.questions.map(q => [q.id, 1]));
    const r = scoreLikertIndicator(BAT12, ans);
    expect(r?.score).toBe(100);
  });

  it('全答 5（最差 capacity）→ score 0', () => {
    const ans = Object.fromEntries(BAT12.questions.map(q => [q.id, 5]));
    const r = scoreLikertIndicator(BAT12, ans);
    expect(r?.score).toBe(0);
  });

  it('全答 3（中位）→ score 50', () => {
    const ans = Object.fromEntries(BAT12.questions.map(q => [q.id, 3]));
    const r = scoreLikertIndicator(BAT12, ans);
    expect(r?.score).toBe(50);
  });

  it('subScale exhaustion 全 3 → subscale mean 3.0 觸發 cutoff', () => {
    const ans: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) ans[`psychological.burnout.q${i}`] = 3;
    const r = scoreLikertIndicator(BAT12, ans);
    const exh = r?.subScaleScores?.find(s => s.subScaleId === 'bat12.exhaustion');
    expect(exh?.subMean).toBe(3);
    expect(exh?.cutoffFlag).toBe(true);
    expect(exh?.cutoffSeverity).toBe('advisory');
  });
});

describe('scoreLikertIndicator — PSS-4 reverseScored', () => {
  it('q1=2, q2=3(reverse→1), q3=1(reverse→3), q4=2 → effective sum = 8', () => {
    const r = scoreLikertIndicator(PSS4, {
      'psychological.stress.q1': 2,
      'psychological.stress.q2': 3,
      'psychological.stress.q3': 1,
      'psychological.stress.q4': 2,
    });
    expect(r?.rawSum).toBe(8);  // 反向計分後
    expect(r?.cutoffFlag).toBe(false);  // 未到 9
  });

  it('q1=4, q2=0(reverse→4), q3=0(reverse→4), q4=4 → effective sum = 16 → cutoff', () => {
    const r = scoreLikertIndicator(PSS4, {
      'psychological.stress.q1': 4,
      'psychological.stress.q2': 0,
      'psychological.stress.q3': 0,
      'psychological.stress.q4': 4,
    });
    expect(r?.rawSum).toBe(16);
    expect(r?.cutoffFlag).toBe(true);
    expect(r?.cutoffSeverity).toBe('advisory');
  });
});

describe('scoreLikertIndicator — PHQ-2 cutoff', () => {
  it('全答 0 → no cutoff', () => {
    const r = scoreLikertIndicator(PHQ2, {
      'psychological.depression.q1': 0,
      'psychological.depression.q2': 0,
    });
    expect(r?.rawSum).toBe(0);
    expect(r?.cutoffFlag).toBe(false);
  });

  it('sum=3 → cutoff', () => {
    const r = scoreLikertIndicator(PHQ2, {
      'psychological.depression.q1': 2,
      'psychological.depression.q2': 1,
    });
    expect(r?.rawSum).toBe(3);
    expect(r?.cutoffFlag).toBe(true);
  });

  it('partial answer (only q1) → return null (minCompletionPolicy=1.0)', () => {
    const r = scoreLikertIndicator(PHQ2, { 'psychological.depression.q1': 3 });
    expect(r).toBeNull();
  });
});

describe('scoreLikertIndicator — direction', () => {
  it('higher_is_better: full max → capacity 100', () => {
    const ind: LikertIndicator = {
      kind: 'likert', id: 'vitality.sleep_quality', domain: 'vitality',
      label: 'sleep', style: 'capacity', direction: 'higher_is_better',
      weight: 1, license: 'public-domain', maxScore: 3,
      questions: [{ id: 'vitality.sleep_quality.q1', text: 'q', options: [] }],
    };
    const r = scoreLikertIndicator(ind, { 'vitality.sleep_quality.q1': 3 });
    expect(r?.score).toBe(100);
  });
});
