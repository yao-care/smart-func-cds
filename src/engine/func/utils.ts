// src/engine/func/utils.ts

/**
 * Standard normal CDF approximation (Abramowitz & Stegun 26.2.17).
 * Max abs error ~7.5e-8, accurate for all real z.
 */
export function zToPercentile(z: number): number {
  if (z === 0) return 0.5;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-z * z / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median: empty array');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Reverse-scored Likert item: raw=high → effective=low. */
export function reverseScoreOf(raw: number, maxScore: number, minScore: number): number {
  return maxScore - raw + minScore;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
