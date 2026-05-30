// tests/engine/func/utils.test.ts
import { describe, it, expect } from 'vitest';
import { zToPercentile, median, reverseScoreOf, clamp } from '../../../src/engine/func/utils';

describe('zToPercentile (Abramowitz 26.2.17)', () => {
  it('z=0 → 0.5', () => expect(zToPercentile(0)).toBeCloseTo(0.5, 4));
  it('z=1.96 → ~0.975', () => expect(zToPercentile(1.96)).toBeCloseTo(0.975, 3));
  it('z=-1.96 → ~0.025', () => expect(zToPercentile(-1.96)).toBeCloseTo(0.025, 3));
  it('z=4 → near 1.0', () => expect(zToPercentile(4)).toBeGreaterThan(0.9999));
  it('z=-4 → near 0', () => expect(zToPercentile(-4)).toBeLessThan(0.0001));
});

describe('median', () => {
  it('odd length', () => expect(median([1, 3, 5, 2, 4])).toBe(3));
  it('even length: 兩中位數平均', () => expect(median([1, 2, 3, 4])).toBe(2.5));
  it('single', () => expect(median([42])).toBe(42));
  it('empty array throws', () => expect(() => median([])).toThrow('median: empty array'));
});

describe('reverseScoreOf', () => {
  it('PSS-4 q2 raw=3 → effective=1 (maxScore=4, minScore=0)', () => {
    expect(reverseScoreOf(3, 4, 0)).toBe(1);
  });
  it('PSS-4 q3 raw=0 → effective=4', () => {
    expect(reverseScoreOf(0, 4, 0)).toBe(4);
  });
  it('PSS-4 raw=4 → effective=0 (對稱)', () => {
    expect(reverseScoreOf(4, 4, 0)).toBe(0);
  });
  it('BAT-12 raw=5 → effective=1 (maxScore=5, minScore=1)', () => {
    expect(reverseScoreOf(5, 5, 1)).toBe(1);
  });
  it('BAT-12 raw=1 → effective=5 (對稱)', () => {
    expect(reverseScoreOf(1, 5, 1)).toBe(5);
  });
  it('BAT-12 raw=3 → effective=3 (中位不變)', () => {
    expect(reverseScoreOf(3, 5, 1)).toBe(3);
  });
});

describe('clamp', () => {
  it('within bounds', () => expect(clamp(5, 0, 10)).toBe(5));
  it('below', () => expect(clamp(-3, 0, 10)).toBe(0));
  it('above', () => expect(clamp(15, 0, 10)).toBe(10));
  it('at lower boundary', () => expect(clamp(0, 0, 10)).toBe(0));
  it('at upper boundary', () => expect(clamp(10, 0, 10)).toBe(10));
});
