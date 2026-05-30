import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ResultView from '../../src/components/assess/ResultView.svelte';
import { assessmentStore } from '../../src/lib/stores/assessment.svelte';
import type { AssessmentPatient, Assessment } from '../../src/lib/db/schema';
import type { DomainScore, IndicatorScore } from '../../src/engine/func/scorer';

/** Build a minimal adult patient (age derived from birthDate falls in 18-39). */
function makePatient(birthOffsetYears: number): AssessmentPatient {
  const birth = new Date();
  birth.setFullYear(birth.getFullYear() - birthOffsetYears);
  return {
    id: 'test-patient',
    birthDate: birth.toISOString().slice(0, 10),
    gender: 'male',
    createdAt: new Date(),
  };
}

function makeAssessment(): Assessment {
  return {
    id: 'test-assess',
    patientId: 'test-patient',
    status: 'started',
    language: 'zh-TW',
    currentStep: 2,
    startedAt: new Date(),
    fhirSubmitted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Assessment;
}

function ds(domain: DomainScore['domain'], band: DomainScore['band'], score: number): DomainScore {
  return { domain, score, band, contributingIndicators: 1, missingIndicators: [] };
}

function is(domain: IndicatorScore['domain'], score: number): IndicatorScore {
  return { indicatorId: `${domain}.x`, domain, style: 'capacity', kind: 'likert', score };
}

describe('ResultView', () => {
  beforeEach(() => {
    assessmentStore.reset();
  });

  afterEach(() => {
    cleanup();
    assessmentStore.reset();
  });

  it('shows computing placeholder before triage result is ready', () => {
    // No ageGroup → $effect early-returns → triageResult stays null → loading
    render(ResultView);
    expect(screen.getByText(/正在產生評估結果/)).toBeInTheDocument();
  });

  it('renders one of the four IC category labels once triage resolves', async () => {
    assessmentStore.patient = makePatient(30);
    assessmentStore.assessment = makeAssessment();
    assessmentStore.partialAnalysis = {
      indicatorScores: [is('vitality', 90), is('locomotion', 90), is('cognition', 90), is('psychological', 90), is('sensory', 90)],
      domainScores: [
        ds('vitality', 'high', 90), ds('locomotion', 'high', 90), ds('cognition', 'high', 90),
        ds('psychological', 'high', 90), ds('sensory', 'high', 90),
      ],
      applicableWeights: {},
    };

    render(ResultView);

    const label = await screen.findByRole('heading', { name: /功能良好|建議觀察|建議諮詢醫師|評估未完成/ });
    expect(label).toBeInTheDocument();
    expect(screen.queryByText(/正在產生評估結果/)).not.toBeInTheDocument();
  });

  it('renders a summary paragraph from the triage result', async () => {
    assessmentStore.patient = makePatient(30);
    assessmentStore.assessment = makeAssessment();
    assessmentStore.partialAnalysis = {
      indicatorScores: [is('vitality', 90), is('locomotion', 90), is('cognition', 90)],
      domainScores: [ds('vitality', 'high', 90), ds('locomotion', 'high', 90), ds('cognition', 'high', 90)],
      applicableWeights: {},
    };

    const { container } = render(ResultView);
    await screen.findByRole('heading', { name: /功能良好|建議觀察|建議諮詢醫師|評估未完成/ });

    expect(container.textContent ?? '').toMatch(/評估|建議|功能|良好|觀察|諮詢/);
  });
});
