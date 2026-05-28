// src/engine/func/scorer.ts (部分 — 後續 Task 1.4-1.6 補)
import type { Indicator, LikertIndicator, ObjectiveIndicator } from './questionnaire';
import { reverseScoreOf, zToPercentile, median, clamp } from './utils';
import type { ICDomain } from '../../lib/education/schemas';
import type { AgeGroupAdult } from '../../lib/utils/age-groups';

export interface SubScaleScore {
  subScaleId: string;
  score: number | null;
  subMean?: number;
  cutoffFlag?: boolean;
  cutoffSeverity?: 'consult' | 'advisory';
}

export interface IndicatorScore {
  indicatorId: string;
  domain: ICDomain;
  style: 'capacity' | 'symptom';
  kind: 'likert' | 'objective';
  score: number;
  rawSum?: number;
  cutoffFlag?: boolean;
  cutoffSeverity?: 'consult' | 'advisory';
  subScaleScores?: SubScaleScore[];
  measuredValue?: number;
  zScore?: number;
  validTrialCount?: number;
  totalTrialCount?: number;
  questionsAnswered?: number;
  questionsTotal?: number;
}

export function scoreLikertIndicator(
  indicator: LikertIndicator,
  answers: Record<string, number>,
): IndicatorScore | null {
  const N = indicator.questions.length;
  const minScore = indicator.minScore ?? 0;
  const maxScore = indicator.maxScore;
  const range = maxScore - minScore;
  if (range <= 0) {
    throw new Error(`Invalid scale for ${indicator.id}: maxScore must > minScore`);
  }

  const validAnswerEntries = indicator.questions.map(q => ({
    qid: q.id,
    raw: answers[q.id],
    reverseScored: q.reverseScored ?? false,
  })).filter(e => Number.isFinite(e.raw));

  if (validAnswerEntries.length === 0) return null;

  const policy = indicator.minCompletionPolicy ?? (N <= 4 ? 1.0 : 0.5);
  const minRequired = Math.ceil(N * policy);
  if (validAnswerEntries.length < minRequired) return null;

  const effectiveAnswers = validAnswerEntries.map(e => ({
    qid: e.qid,
    effective: e.reverseScored ? reverseScoreOf(e.raw, maxScore, minScore) : e.raw,
  }));

  const rawSum = effectiveAnswers.reduce((s, e) => s + e.effective, 0);
  const adjustedSum = (rawSum / effectiveAnswers.length) * N;

  // CRITICAL formula for 1-based scale: (adjustedSum - N * minScore) / (N * range)
  const raw = (adjustedSum - N * minScore) / (N * range);
  const capacity = indicator.direction === 'higher_is_better' ? raw : 1 - raw;

  let cutoffFlag: boolean | undefined;
  let cutoffSeverity: 'consult' | 'advisory' | undefined;
  if (indicator.clinicalCutoff && validAnswerEntries.length === N) {
    const { threshold, comparator, severity } = indicator.clinicalCutoff;
    cutoffFlag = comparator === '>=' ? rawSum >= threshold : rawSum <= threshold;
    if (cutoffFlag) cutoffSeverity = severity;
  }

  let subScaleScores: SubScaleScore[] | undefined;
  if (indicator.subScales) {
    subScaleScores = indicator.subScales.map(sub => {
      const subAnswers = sub.questionIds
        .map(qid => effectiveAnswers.find(e => e.qid === qid))
        .filter((e): e is NonNullable<typeof e> => e !== undefined);
      if (subAnswers.length !== sub.questionIds.length) {
        return { subScaleId: sub.id, score: null };
      }
      const subSum = subAnswers.reduce((s, e) => s + e.effective, 0);
      const subMean = subSum / sub.questionIds.length;
      const subRaw = (subMean - minScore) / range;
      const subCapacity = indicator.direction === 'higher_is_better' ? subRaw : 1 - subRaw;

      let subCutoffFlag: boolean | undefined;
      let subCutoffSeverity: 'consult' | 'advisory' | undefined;
      if (sub.clinicalCutoff) {
        const { threshold, comparator, severity } = sub.clinicalCutoff;
        subCutoffFlag = comparator === '>=' ? subMean >= threshold : subMean <= threshold;
        if (subCutoffFlag) subCutoffSeverity = severity;
      }

      return {
        subScaleId: sub.id,
        score: Math.round(100 * subCapacity),
        subMean,
        cutoffFlag: subCutoffFlag,
        cutoffSeverity: subCutoffSeverity,
      };
    });
  }

  return {
    indicatorId: indicator.id,
    domain: indicator.domain,
    style: indicator.style,
    kind: 'likert',
    score: Math.round(100 * capacity),
    rawSum,
    cutoffFlag,
    cutoffSeverity,
    subScaleScores,
    questionsAnswered: validAnswerEntries.length,
    questionsTotal: N,
  };
}

export function scoreObjectiveIndicator(
  indicator: ObjectiveIndicator,
  trials: number[],
  ageGroup: AgeGroupAdult,
): IndicatorScore | null {
  const { test } = indicator;

  // TS discriminated narrowing: only RT has warmupTrials + validRangeMs;
  // TMT-A is a single timing value with no per-trial outlier handling.
  let scoredTrials = trials;
  let validTrials: number[] | undefined;

  if (test.type === 'reaction-time') {
    scoredTrials = trials.slice(test.warmupTrials ?? 0);
    if (scoredTrials.length === 0) return null;

    const { min, max } = test.validRangeMs;
    validTrials = scoredTrials.filter(v => v >= min && v <= max);
  } else if (test.type === 'tmt-a') {
    validTrials = scoredTrials;
  }

  if (!validTrials || validTrials.length === 0) return null;

  const measuredValue = test.type === 'reaction-time'
    ? median(validTrials)
    : validTrials[0];

  const norm = test.norms[ageGroup];
  if (norm === null) {
    if (import.meta.env?.PROD) {
      throw new Error(`Norm for ${indicator.id}@${ageGroup} is null in prod build`);
    }
    return null;
  }
  const { mean: normMean, std: normStd } = norm;
  if (normStd <= 0 || normStd < Math.abs(normMean) * 0.01) return null;

  let z = (measuredValue - normMean) / normStd;
  if (indicator.direction === 'higher_is_worse') z = -z;
  z = clamp(z, -4, 4);

  const percentile = zToPercentile(z);

  return {
    indicatorId: indicator.id,
    domain: indicator.domain,
    style: indicator.style,
    kind: 'objective',
    score: Math.round(100 * percentile),
    measuredValue,
    zScore: z,
    validTrialCount: validTrials.length,
    totalTrialCount: trials.length,
  };
}
