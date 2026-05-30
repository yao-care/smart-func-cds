import type { Assessment, AssessmentPatient } from '../db/schema';
import * as assessmentDao from '../db/assessments';
import { ageGroupAdult, type AgeGroupAdult } from '../utils/age-groups';
import type { TriageResult } from '../../engine/func/triage';
import type { IndicatorScore, DomainScore } from '../../engine/func/scorer';

// S1 IC flow: profile → questionnaire → result. Objective interactive tests are
// rendered inline within the questionnaire module (no separate steps).
const STEPS = ['profile', 'questionnaire', 'result'] as const;
export type AssessmentStep = typeof STEPS[number];

export const STEP_LABELS: Record<AssessmentStep, string> = {
  profile: '基本資料',
  questionnaire: '功能問卷',
  result: '評估結果',
};

/** 各模組即時產出的分析結果 */
export interface PartialAnalysis {
  /** Per-indicator Likert answers keyed by question id. */
  answers?: Record<string, number>;
  /** Per-indicator objective trial arrays keyed by indicator id. */
  objectiveResults?: Record<string, number[]>;
  /** Computed indicator scores (set once the questionnaire completes). */
  indicatorScores?: IndicatorScore[];
  /** Computed domain scores. */
  domainScores?: DomainScore[];
  /** Applicable indicator weights from scoring. */
  applicableWeights?: Record<string, number>;
}

class AssessmentStore {
  patient = $state<AssessmentPatient | null>(null);
  assessment = $state<Assessment | null>(null);
  currentStepIndex = $state(0);
  isLoading = $state(false);
  error = $state<string | null>(null);

  /** 各模組即時累積的分析結果 */
  partialAnalysis = $state<PartialAnalysis>({});

  /** 最終分流結果（進入 result 步驟時由 ResultView 計算） */
  triageResult = $state<TriageResult | null>(null);

  currentStep = $derived(STEPS[this.currentStepIndex] ?? 'profile');
  ageGroup = $derived<AgeGroupAdult | null>(
    this.patient?.birthDate ? ageGroupAdult(this.patient.birthDate) : null
  );
  isFirstStep = $derived(this.currentStepIndex === 0);
  isLastStep = $derived(this.currentStepIndex === STEPS.length - 1);
  progress = $derived(this.currentStepIndex / (STEPS.length - 1));
  steps = STEPS;

  /** 各模組完成時呼叫，累積分析結果 */
  addAnalysis(partial: Partial<PartialAnalysis>): void {
    this.partialAnalysis = { ...this.partialAnalysis, ...partial };
  }

  async startNew(patientData: Omit<AssessmentPatient, 'id' | 'createdAt'>): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const patient: AssessmentPatient = {
        ...patientData,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      };
      await assessmentDao.createPatient(patient);
      this.patient = patient;
      const assessment = await assessmentDao.createAssessment(patient.id);
      this.assessment = assessment;
      this.currentStepIndex = 1;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to start assessment';
    } finally {
      this.isLoading = false;
    }
  }

  async resume(assessmentId: string): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const assessment = await assessmentDao.getAssessment(assessmentId);
      if (!assessment) throw new Error('Assessment not found');
      const patient = await assessmentDao.getPatient(assessment.patientId);
      if (!patient) throw new Error('Patient not found');
      this.assessment = assessment;
      this.patient = patient;
      this.currentStepIndex = assessment.currentStep;
      await assessmentDao.updateAssessmentStatus(assessmentId, 'resumed');
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to resume assessment';
    } finally {
      this.isLoading = false;
    }
  }

  async nextStep(): Promise<void> {
    if (this.currentStepIndex < STEPS.length - 1) {
      this.currentStepIndex++;
      if (this.assessment) {
        await assessmentDao.updateAssessmentStep(this.assessment.id, this.currentStepIndex);
      }
    }
  }

  async prevStep(): Promise<void> {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      if (this.assessment) {
        await assessmentDao.updateAssessmentStep(this.assessment.id, this.currentStepIndex);
      }
    }
  }

  async pause(): Promise<void> {
    if (this.assessment) {
      await assessmentDao.updateAssessmentStatus(this.assessment.id, 'paused');
      this.assessment = { ...this.assessment, status: 'paused' };
    }
  }

  async complete(): Promise<void> {
    if (this.assessment) {
      await assessmentDao.updateAssessmentStatus(this.assessment.id, 'completed');
      this.assessment = { ...this.assessment, status: 'completed', completedAt: new Date() };
    }
  }

  reset(): void {
    this.patient = null;
    this.assessment = null;
    this.currentStepIndex = 0;
    this.error = null;
    this.partialAnalysis = {};
    this.triageResult = null;
  }
}

export const assessmentStore = new AssessmentStore();
