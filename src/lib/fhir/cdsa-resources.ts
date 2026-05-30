import type { TriageResult } from '../../engine/func/triage';
import type { Assessment, AssessmentPatient } from '../db/schema';

/** Project-owned coding/identifier systems.
 *  Func IC is an in-house instrument; codes are namespaced under the project
 *  domain. (S1 minimal write-back; full FHIR profiling deferred to S2.) */
export const CODE_SYSTEM = 'https://smart-func-cds.yao.care/code';
export const ID_SYSTEM = 'https://smart-func-cds.yao.care/assessment';
export const CONFIDENCE_EXT_URL = 'https://smart-func-cds.yao.care/extension/triage-confidence';

const REPORT_CODE = {
  system: CODE_SYSTEM,
  code: 'func-assessment',
  display: '成人功能健康評估（內在能力 IC）',
};

/**
 * Build a FHIR Patient resource from assessment-subject data.
 * Note: minimal — only what's needed for the assessment context.
 */
export function buildSubjectPatient(patient: AssessmentPatient): object {
  return {
    resourceType: 'Patient',
    id: patient.id,
    birthDate: patient.birthDate,
    gender: patient.gender === 'other' ? 'unknown' : patient.gender,
  };
}

function observationCode(domain: string) {
  return {
    system: CODE_SYSTEM,
    code: `func-${domain}`,
    display: `Func IC ${domain}`,
  };
}

/**
 * Build FHIR Observation resources for each scored IC domain.
 * Each domain score becomes a separate Observation, identified by
 * `${assessmentId}::${domain}` under the project ID system so the resolver can
 * reverse-map a Bundle back to an Assessment.
 */
export function buildAssessmentObservations(
  assessment: Assessment,
  patientId: string,
  triageResult: TriageResult,
): object[] {
  const observations: object[] = [];

  for (const d of triageResult.domainScores) {
    const isLow = d.band !== 'high';
    observations.push({
      resourceType: 'Observation',
      identifier: [
        {
          system: ID_SYSTEM,
          value: `${assessment.id}::${d.domain}`,
        },
      ],
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'survey',
              display: 'Survey',
            },
          ],
        },
      ],
      code: {
        coding: [observationCode(d.domain)],
        text: `Func IC ${d.domain}`,
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueQuantity: {
        value: d.score,
        unit: 'score',
      },
      interpretation: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: isLow ? 'L' : 'N',
              display: isLow ? 'Low' : 'Normal',
            },
          ],
        },
      ],
      note: [{ text: `band: ${d.band}` }],
    });
  }

  return observations;
}

/**
 * Build a FHIR DiagnosticReport for the overall triage result.
 * Carries identifier (so resolver can find it), confidence (extension),
 * and effective period (so we can reconstruct startedAt / completedAt).
 */
export function buildTriageDiagnosticReport(
  assessment: Assessment,
  patientId: string,
  triageResult: TriageResult,
  observationIds: string[],
): object {
  const startedAt = assessment.startedAt instanceof Date
    ? assessment.startedAt
    : new Date(assessment.startedAt);
  const completedAt = assessment.completedAt
    ? (assessment.completedAt instanceof Date
        ? assessment.completedAt
        : new Date(assessment.completedAt))
    : null;

  // FHIR requires effectivePeriod.end if present — degrade to effectiveDateTime
  // when the assessment hasn't completed.
  const effective = completedAt
    ? {
        effectivePeriod: {
          start: startedAt.toISOString(),
          end: completedAt.toISOString(),
        },
      }
    : { effectiveDateTime: startedAt.toISOString() };

  // SNOMED mapping for the 4-category IC triage. (Approximate; S2 will refine.)
  const snomed = (() => {
    switch (triageResult.category) {
      case 'normal': return { code: '17621005', display: 'Normal' };
      case 'observe': return { code: '394848005', display: 'Follow-up' };
      case 'consult': return { code: '3457005', display: 'Referral' };
      case 'incomplete': return { code: '385660001', display: 'Not done' };
    }
  })();

  return {
    resourceType: 'DiagnosticReport',
    identifier: [
      { system: ID_SYSTEM, value: assessment.id },
    ],
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: 'OTH',
            display: 'Other',
          },
        ],
      },
    ],
    code: { coding: [REPORT_CODE] },
    subject: { reference: `Patient/${patientId}` },
    ...effective,
    issued: new Date().toISOString(),
    result: observationIds.map(id => ({ reference: `Observation/${id}` })),
    extension: [
      {
        url: CONFIDENCE_EXT_URL,
        valueDecimal: triageResult.confidence,
      },
    ],
    conclusion: triageResult.summary,
    conclusionCode: [
      {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: snomed.code,
            display: snomed.display,
          },
        ],
      },
    ],
  };
}
