import { describe, it, expect, vi } from 'vitest';
import {
  bundleToAssessment,
  fetchAssessmentFromFhir,
  listAssessmentsFromFhir,
  observationsToDomainScores,
  parseObservationCode,
} from '../../../src/lib/fhir/assessment-fetch';
import { ID_SYSTEM, CODE_SYSTEM, CONFIDENCE_EXT_URL } from '../../../src/lib/fhir/cdsa-resources';

const ASSESSMENT_ID = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';

/** Mirrors buildAssessmentObservations output for one IC domain. */
function makeObservation(domain: string, score: number, band: 'high' | 'moderate' | 'low'): Record<string, any> {
  const isLow = band !== 'high';
  return {
    resourceType: 'Observation',
    identifier: [{ system: ID_SYSTEM, value: `${ASSESSMENT_ID}::${domain}` }],
    status: 'final',
    code: { coding: [{ system: CODE_SYSTEM, code: `func-${domain}` }], text: `Func IC ${domain}` },
    subject: { reference: 'Patient/patient-123' },
    valueQuantity: { value: score, unit: 'score' },
    interpretation: [{ coding: [{ code: isLow ? 'L' : 'N' }] }],
    note: [{ text: `band: ${band}` }],
  };
}

function makeReport(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    resourceType: 'DiagnosticReport',
    id: 'fhir-report-1',
    status: 'final',
    identifier: [{ system: ID_SYSTEM, value: ASSESSMENT_ID }],
    code: { coding: [{ system: CODE_SYSTEM, code: 'func-assessment' }] },
    subject: { reference: 'Patient/patient-123' },
    effectivePeriod: { start: '2026-05-14T10:00:00Z', end: '2026-05-14T10:25:00Z' },
    extension: [{ url: CONFIDENCE_EXT_URL, valueDecimal: 0.87 }],
    conclusion: '部分面向需追蹤',
    conclusionCode: [{ coding: [{ system: 'http://snomed.info/sct', code: '394848005' }] }],
    ...overrides,
  };
}

describe('parseObservationCode', () => {
  it('parses Func IC domain code', () => {
    expect(parseObservationCode('Func IC vitality')).toEqual({
      domain: 'vitality',
    });
  });

  it('returns null on mismatch', () => {
    expect(parseObservationCode('not a func code')).toBeNull();
  });
});

describe('observationsToDomainScores', () => {
  it('round-trips domain / score / band from Observations', () => {
    const scores = observationsToDomainScores([
      makeObservation('vitality', 82, 'high'),
      makeObservation('cognition', 45, 'moderate'),
      makeObservation('sensory', 30, 'low'),
    ]);
    expect(scores).toEqual([
      { domain: 'vitality', score: 82, band: 'high', contributingIndicators: 0, missingIndicators: [] },
      { domain: 'cognition', score: 45, band: 'moderate', contributingIndicators: 0, missingIndicators: [] },
      { domain: 'sensory', score: 30, band: 'low', contributingIndicators: 0, missingIndicators: [] },
    ]);
  });

  it('falls back to code.text when identifier is missing, and to interpretation when note is absent', () => {
    const obs = makeObservation('locomotion', 50, 'moderate');
    delete obs.identifier; // force code.text path
    delete obs.note;       // force interpretation fallback (L → low)
    const scores = observationsToDomainScores([obs]);
    expect(scores).toEqual([
      { domain: 'locomotion', score: 50, band: 'low', contributingIndicators: 0, missingIndicators: [] },
    ]);
  });

  it('skips unknown domains and non-numeric values', () => {
    expect(observationsToDomainScores([makeObservation('not_a_domain', 10, 'low')])).toEqual([]);
    const bad = makeObservation('vitality', 0, 'high');
    delete bad.valueQuantity;
    expect(observationsToDomainScores([bad])).toEqual([]);
  });
});

describe('bundleToAssessment', () => {
  it('round-trips per-domain scores + flaggedDomains from Observations', () => {
    const a = bundleToAssessment(makeReport(), [
      makeObservation('vitality', 82, 'high'),
      makeObservation('psychological', 38, 'low'),
    ]);
    expect(a.triageResult?.domainScores).toHaveLength(2);
    expect(a.triageResult?.flaggedDomains).toEqual(['psychological']); // band !== high
    expect(a.triageResult?.completedDomains).toBe(2);
  });

  it('reconstructs an Assessment from DiagnosticReport extension + period', () => {
    const a = bundleToAssessment(makeReport(), []);
    expect(a.id).toBe(ASSESSMENT_ID);
    expect(a.patientId).toBe('patient-123');
    expect(a.triageResult?.category).toBe('observe');
    expect(a.triageResult?.confidence).toBe(0.87);
    expect(a.triageResult?.summary).toBe('部分面向需追蹤');
    expect(a.fhirSubmitted).toBe(true);
    expect(a.fhirDiagnosticReportId).toBe('fhir-report-1');
    expect(a.status).toBe('completed');
    expect(a.completedAt).toBeInstanceOf(Date);
  });

  it('falls back to effectiveDateTime when effectivePeriod is absent (in-progress assessment)', () => {
    const a = bundleToAssessment(
      makeReport({ effectivePeriod: undefined, effectiveDateTime: '2026-05-14T10:00:00Z' }),
      [],
    );
    expect(a.startedAt.toISOString()).toBe('2026-05-14T10:00:00.000Z');
    expect(a.completedAt).toBeUndefined();
  });

  it('strips legacy conclusion prefix', () => {
    const a = bundleToAssessment(
      makeReport({ conclusion: '部分面向需持續追蹤觀察（信心度 87%）。後續追蹤建議...' }),
      [],
    );
    expect(a.triageResult?.summary).toBe('後續追蹤建議...');
  });

  it('uses report.id as fallback when identifier is missing', () => {
    const a = bundleToAssessment(makeReport({ identifier: [] }), []);
    expect(a.id).toBe('fhir-report-1');
  });

  it('maps SNOMED codes to triage categories', () => {
    const cases: Array<[string, 'normal' | 'observe' | 'consult' | 'incomplete']> = [
      ['17621005', 'normal'],
      ['394848005', 'observe'],
      ['3457005', 'consult'],
      ['385660001', 'incomplete'],
    ];
    for (const [code, expected] of cases) {
      const a = bundleToAssessment(
        makeReport({ conclusionCode: [{ coding: [{ code }] }] }),
        [],
      );
      expect(a.triageResult?.category).toBe(expected);
    }
  });
});

describe('fetchAssessmentFromFhir', () => {
  it('returns null when no DiagnosticReport in bundle', async () => {
    const client = { request: vi.fn().mockResolvedValue({ entry: [] }) };
    expect(await fetchAssessmentFromFhir(ASSESSMENT_ID, client)).toBeNull();
  });

  it('passes the identifier-and-include query string', async () => {
    const client = { request: vi.fn().mockResolvedValue({ entry: [{ resource: makeReport() }] }) };
    await fetchAssessmentFromFhir(ASSESSMENT_ID, client);
    expect(client.request).toHaveBeenCalledWith(
      expect.stringContaining(`DiagnosticReport?identifier=${ID_SYSTEM}|${ASSESSMENT_ID}`),
    );
    expect(client.request.mock.calls[0][0]).toContain('_include=DiagnosticReport:result');
  });

  it('returns the parsed Assessment', async () => {
    const client = { request: vi.fn().mockResolvedValue({ entry: [{ resource: makeReport() }] }) };
    const a = await fetchAssessmentFromFhir(ASSESSMENT_ID, client);
    expect(a?.id).toBe(ASSESSMENT_ID);
    expect(a?.triageResult?.category).toBe('observe');
  });
});

describe('listAssessmentsFromFhir', () => {
  it('queries by patient subject and func report code', async () => {
    const client = { request: vi.fn().mockResolvedValue({ entry: [] }) };
    await listAssessmentsFromFhir('patient-1', client);
    const url = client.request.mock.calls[0][0];
    expect(url).toContain('subject=Patient/patient-1');
    expect(url).toContain(`code=${CODE_SYSTEM}|func-assessment`);
    expect(url).toContain('_sort=-date');
  });

  it('returns summary rows', async () => {
    const client = {
      request: vi.fn().mockResolvedValue({
        entry: [{ resource: makeReport() }, { resource: makeReport({ id: 'fhir-report-2' }) }],
      }),
    };
    const list = await listAssessmentsFromFhir('patient-1', client);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(ASSESSMENT_ID);
    expect(list[0].category).toBe('observe');
  });
});
