// src/engine/func/scorer.ts (部分 — 後續 Task 1.4-1.6 補)
import type { Indicator, LikertIndicator, ObjectiveIndicator } from './questionnaire';
import { reverseScoreOf } from './utils';
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
