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
});
