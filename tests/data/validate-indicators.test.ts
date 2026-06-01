import { describe, it, expect } from 'vitest';
import { validateTierIntegrity } from '../../scripts/validate-indicators';
import type { Indicator } from '../../src/engine/func/questionnaire';

function mk(partial: Partial<Indicator> & { id: string; domain: Indicator['domain'] }): Indicator {
  return {
    kind: 'likert', label: 'x', tier: 'screener', style: 'capacity',
    direction: 'higher_is_better', maxScore: 3, weight: 1.0, license: 'public-domain',
    questions: [{ id: `${partial.id}.q1`, text: 'q', options: [{ label: 'a', score: 0 }, { label: 'b', score: 3 }] }],
    ...partial,
  } as Indicator;
}

describe('validateTierIntegrity', () => {
  it('detail 指標所在域沒有 screener 指標 → 回錯誤', () => {
    const errs = validateTierIntegrity([mk({ id: 'sensory.vision_impact', domain: 'sensory', tier: 'detail' })]);
    expect(errs.some(e => e.includes('sensory') && e.includes('screener'))).toBe(true);
  });

  it('revealDetailWhen 引用不存在的題 → 回錯誤', () => {
    const ind = mk({ id: 'vitality.fatigue', domain: 'vitality' }) as Extract<Indicator, { kind: 'likert' }>;
    ind.revealDetailWhen = { screenerQuestionIds: ['vitality.fatigue.qX'], threshold: 2, comparator: '>=' };
    ind.questions.push({ id: 'vitality.fatigue.q2', text: 'd', tier: 'detail', options: [{ label: 'a', score: 0 }, { label: 'b', score: 3 }] });
    expect(validateTierIntegrity([ind]).some(e => e.includes('qX'))).toBe(true);
  });

  it('有題層 detail 卻無 revealDetailWhen → 回錯誤', () => {
    const ind = mk({ id: 'vitality.fatigue', domain: 'vitality' }) as Extract<Indicator, { kind: 'likert' }>;
    ind.questions.push({ id: 'vitality.fatigue.q2', text: 'd', tier: 'detail', options: [{ label: 'a', score: 0 }, { label: 'b', score: 3 }] });
    expect(validateTierIntegrity([ind]).some(e => e.includes('revealDetailWhen'))).toBe(true);
  });

  it('合法的螢檢+detail 組合 → 無錯誤', () => {
    const screener = mk({ id: 'sensory.functional_acuity', domain: 'sensory' });
    const detail = mk({ id: 'sensory.vision_impact', domain: 'sensory', tier: 'detail' });
    expect(validateTierIntegrity([screener, detail])).toEqual([]);
  });

  it('正確接線的題層 detail（revealDetailWhen 引用存在的螢檢題）→ 無錯誤', () => {
    const ind = mk({ id: 'vitality.fatigue', domain: 'vitality' }) as Extract<Indicator, { kind: 'likert' }>;
    ind.revealDetailWhen = { screenerQuestionIds: ['vitality.fatigue.q1'], threshold: 2, comparator: '>=' };
    ind.questions.push({ id: 'vitality.fatigue.q2', text: 'd', tier: 'detail', options: [{ label: 'a', score: 0 }, { label: 'b', score: 3 }] });
    expect(validateTierIntegrity([ind])).toEqual([]);
  });
});
