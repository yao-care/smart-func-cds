import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import QuestionnaireModule from '../../src/components/assess/QuestionnaireModule.svelte';
import { assessmentStore } from '../../src/lib/stores/assessment.svelte';
import { db } from '../../src/lib/db/schema';
import type { AssessmentPatient, Assessment } from '../../src/lib/db/schema';

/** Build an adult patient (age in 18-39). */
function makePatient(yearsOld: number): AssessmentPatient {
  const birth = new Date();
  birth.setFullYear(birth.getFullYear() - yearsOld);
  return {
    id: 'q-test-patient',
    birthDate: birth.toISOString().slice(0, 10),
    gender: 'male',
    createdAt: new Date(),
  };
}

function makeAssessment(): Assessment {
  return {
    id: 'q-test-assess',
    patientId: 'q-test-patient',
    status: 'started',
    language: 'zh-TW',
    currentStep: 1,
    startedAt: new Date(),
    fhirSubmitted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Assessment;
}

/** Click the first option-btn and wait for transition. */
async function clickFirstOption(): Promise<boolean> {
  const buttons = screen.queryAllByRole('button');
  const optionBtn = buttons.find((b) => b.classList.contains('option-btn'));
  if (!optionBtn) return false;
  await fireEvent.click(optionBtn);
  await new Promise((r) => setTimeout(r, 380));
  return true;
}

/** Click the last option-btn (highest score) and wait. */
async function clickLastOption(): Promise<boolean> {
  const buttons = screen.queryAllByRole('button');
  const optionBtns = buttons.filter((b) => b.classList.contains('option-btn'));
  if (optionBtns.length === 0) return false;
  await fireEvent.click(optionBtns[optionBtns.length - 1]);
  await new Promise((r) => setTimeout(r, 380));
  return true;
}

/** Click the option button with the given label text. */
async function clickOptionByLabel(label: string): Promise<boolean> {
  const buttons = screen.queryAllByRole('button');
  const target = buttons.find((b) => b.classList.contains('option-btn') && b.textContent?.trim() === label);
  if (!target) return false;
  await fireEvent.click(target);
  await new Promise((r) => setTimeout(r, 380));
  return true;
}

/** Get current question id from data-question-id attribute on domain-badge. */
function getCurrentQuestionId(): string | null {
  const badge = document.querySelector('[data-testid="current-question-id"]');
  return badge?.getAttribute('data-question-id') ?? null;
}

/** Get visible total from data-visible-total attribute on progress label. */
function getVisibleTotal(): number {
  const label = document.querySelector('[data-testid="progress-label"]');
  const val = label?.getAttribute('data-visible-total');
  return val ? Number(val) : 0;
}

describe('QuestionnaireModule', () => {
  beforeEach(async () => {
    assessmentStore.reset();
    await db.assessmentEvents.clear();
  });

  afterEach(() => {
    cleanup();
    assessmentStore.reset();
  });

  it('renders without crashing when assessment is uninitialised', () => {
    const { container } = render(QuestionnaireModule);
    expect(container).toBeDefined();
  });

  it('renders progress bar + first question when ageGroup is set', () => {
    assessmentStore.patient = makePatient(30);
    assessmentStore.assessment = makeAssessment();

    render(QuestionnaireModule);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('advances and records a questionnaire_answer event after clicking an answer', async () => {
    assessmentStore.patient = makePatient(30);
    assessmentStore.assessment = makeAssessment();

    render(QuestionnaireModule);

    const initialButtons = screen.getAllByRole('button');
    const firstOption = initialButtons.find((b) => b.classList.contains('option-btn'))!;
    expect(firstOption).toBeTruthy();

    await fireEvent.click(firstOption);

    await waitFor(
      async () => {
        const events = await db.assessmentEvents
          .where('moduleType')
          .equals('questionnaire')
          .toArray();
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].eventType).toBe('questionnaire_answer');
        expect(events[0].data.questionId).toBeTruthy();
        expect(events[0].data.score).toBeGreaterThanOrEqual(0);
      },
      { timeout: 2000 },
    );
  });

  it('persists IC indicator/domain scores to the store after answering all questions', { timeout: 60000 }, async () => {
    assessmentStore.patient = makePatient(30);
    assessmentStore.assessment = makeAssessment();

    render(QuestionnaireModule);

    const MAX_ITERATIONS = 80;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (screen.queryByText('問卷完成！')) break;
      const buttons = screen.queryAllByRole('button');
      const optionBtn = buttons.find((b) => b.classList.contains('option-btn'));
      if (!optionBtn) break;
      await fireEvent.click(optionBtn);
      await new Promise((r) => setTimeout(r, 380));
    }

    await waitFor(
      () => {
        expect(screen.getByText('問卷完成！')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const pa = assessmentStore.partialAnalysis;
    expect(pa.indicatorScores).toBeDefined();
    expect(pa.domainScores).toBeDefined();
    expect((pa.indicatorScores ?? []).length).toBeGreaterThan(0);
    // 5 IC domains should be representable; at least 3 scored from Likert answers.
    expect((pa.domainScores ?? []).length).toBeGreaterThanOrEqual(3);
    for (const d of pa.domainScores ?? []) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it(
    '初始只顯示 12 題 screener：未作答時 visibleTotal = 12',
    async () => {
      assessmentStore.patient = makePatient(30);
      assessmentStore.assessment = makeAssessment();

      render(QuestionnaireModule);

      // Before any answers, bandByDomain is empty → no detail indicators revealed
      // → visibleQuestions = only the 12 screener questions
      await waitFor(() => {
        expect(getVisibleTotal()).toBe(12);
      }, { timeout: 2000 });

      // First question should be the first screener question (sleep_quality.q1)
      expect(getCurrentQuestionId()).toBe('vitality.sleep_quality.q1');
    },
  );

  it(
    'PHQ-2 兩題皆答 3（總分 6≥3）→ visibleQuestions 包含 depression detail（q3 出現）',
    { timeout: 30000 },
    async () => {
      assessmentStore.patient = makePatient(30);
      assessmentStore.assessment = makeAssessment();

      render(QuestionnaireModule);

      // Answer screener questions leading up to depression.q1 with "good" responses
      // so that domains stay at 'high' (no other detail is triggered).
      // Questions 1-6 (in YAML order):
      //   1. vitality.sleep_quality.q1  (capacity)  → last option = "非常好"
      //   2. vitality.nutrition.q1      (capacity)  → last option = "穩定良好"
      //   3. vitality.fatigue.q1        (symptom)   → first option = "從不" (score=0)
      //   4. locomotion.activity_level.q1 (capacity) → last option = "5+ 天"
      //   5. locomotion.walking_ability.q1 (capacity) → last option = "非常輕鬆"
      //   6. cognition.cognitive_self_report.q1 (capacity) → last option = "很好"

      // For simplicity, advance by clicking last option for capacities and first for symptoms.
      // We use question ID tracking to handle order reliably.
      const qActions: Record<string, () => Promise<boolean>> = {
        'vitality.sleep_quality.q1': clickLastOption,
        'vitality.nutrition.q1': clickLastOption,
        'vitality.fatigue.q1': clickFirstOption,       // symptom: "從不" (score=0) → no detail
        'locomotion.activity_level.q1': clickLastOption,
        'locomotion.walking_ability.q1': clickLastOption,
        'cognition.cognitive_self_report.q1': clickLastOption,
      };

      for (let i = 0; i < 6; i++) {
        await waitFor(() => {
          const qid = getCurrentQuestionId();
          expect(qid).toBeTruthy();
        }, { timeout: 2000 });
        const qid = getCurrentQuestionId()!;
        const action = qActions[qid] ?? clickLastOption;
        await action();
      }

      // Now we should be at depression.q1
      await waitFor(() => {
        expect(getCurrentQuestionId()).toBe('psychological.depression.q1');
      }, { timeout: 2000 });

      // Answer depression.q1 with highest score ("幾乎每天", score=3)
      const depQ1answered = await clickOptionByLabel('幾乎每天');
      expect(depQ1answered).toBe(true);

      // Answer depression.q2 with highest score ("幾乎每天", score=3)
      // PHQ-2 total = 3+3=6 >= threshold=3 → detail revealed
      await waitFor(() => {
        expect(getCurrentQuestionId()).toBe('psychological.depression.q2');
      }, { timeout: 2000 });

      const depQ2answered = await clickOptionByLabel('幾乎每天');
      expect(depQ2answered).toBe(true);

      // After q1+q2 answered with high scores, depression.q3 (first detail) should be current
      await waitFor(() => {
        expect(getCurrentQuestionId()).toBe('psychological.depression.q3');
      }, { timeout: 3000 });

      // Also verify the question text is correct
      expect(
        screen.getByText('過去 2 週，您入睡困難、睡不安穩，或睡得太多'),
      ).toBeInTheDocument();
    },
  );
});
