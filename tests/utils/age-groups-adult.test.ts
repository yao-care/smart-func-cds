import { describe, it, expect } from 'vitest';
import { ageInYears, isAdult, ageGroupAdult, isWithinValidatedRange } from '../../src/lib/utils/age-groups';

describe('adult age helpers', () => {
  it('ageInYears: 1990-01-15 in 2026', () => {
    expect(ageInYears('1990-01-15')).toBeGreaterThanOrEqual(35);
  });

  it('isAdult: 17 yrs false, 18 yrs true', () => {
    const today = new Date();
    const y17 = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate()).toISOString();
    const y18 = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString();
    expect(isAdult(y17)).toBe(false);
    expect(isAdult(y18)).toBe(true);
  });

  it('ageGroupAdult: 18-39 / 40-54 / 55-64 boundaries', () => {
    const today = new Date();
    const mkBirth = (yrsAgo: number) =>
      new Date(today.getFullYear() - yrsAgo, today.getMonth(), today.getDate()).toISOString();
    expect(ageGroupAdult(mkBirth(18))).toBe('18-39');
    expect(ageGroupAdult(mkBirth(39))).toBe('18-39');
    expect(ageGroupAdult(mkBirth(40))).toBe('40-54');
    expect(ageGroupAdult(mkBirth(54))).toBe('40-54');
    expect(ageGroupAdult(mkBirth(55))).toBe('55-64');
    expect(ageGroupAdult(mkBirth(64))).toBe('55-64');
    expect(ageGroupAdult(mkBirth(65))).toBe('55-64');
  });

  it('isWithinValidatedRange: 17 false, 18 true, 64 true, 65 false', () => {
    const today = new Date();
    const mkBirth = (yrsAgo: number) =>
      new Date(today.getFullYear() - yrsAgo, today.getMonth(), today.getDate()).toISOString();
    expect(isWithinValidatedRange(mkBirth(17))).toBe(false);
    expect(isWithinValidatedRange(mkBirth(18))).toBe(true);
    expect(isWithinValidatedRange(mkBirth(64))).toBe(true);
    expect(isWithinValidatedRange(mkBirth(65))).toBe(false);
  });
});
