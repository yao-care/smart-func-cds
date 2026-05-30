import type { Assessment } from '../db/schema';
import type { TriageCategory } from '../../engine/func/triage';
import { CODE_SYSTEM, ID_SYSTEM, CONFIDENCE_EXT_URL } from './cdsa-resources';

export interface AssessmentSummary {
  id: string;
  fhirReportId: string;
  /** FHIR Patient reference (e.g. "Patient/abc123"). Useful for the
   *  cross-patient workspace list to show which subject each row is for. */
  patientRef: string;
  date: Date;
  category: TriageCategory;
  summary: string;
}

interface FhirClient {
  request(query: string): Promise<unknown>;
}

/** Lightweight Bundle entry shape we rely on. */
interface BundleEntry {
  resource: Record<string, unknown>;
}

interface Bundle {
  entry?: BundleEntry[];
}

/**
 * Map SNOMED conclusionCode → IC triage category. Falls back to 'observe'
 * when the code is unrecognised so reverse-mapped reports stay usable.
 */
function snomedToCategory(code: string | undefined): TriageCategory {
  switch (code) {
    case '17621005': return 'normal';
    case '394848005': return 'observe';
    case '3457005': return 'consult';
    case '385660001': return 'incomplete';
    default: return 'observe';
  }
}

/** Strip backward-compat conclusion prefix「<分類>（信心度 X%）。 」if present. */
function stripLegacyConclusionPrefix(conclusion: string): string {
  return conclusion.replace(/^.+?（信心度\s*\d+%）。\s*/, '');
}

/**
 * Parse Observation.code.text "Func IC vitality". Returns null on miss.
 */
export function parseObservationCode(text: string): { domain: string } | null {
  const m = text.match(/^Func IC\s+(\w+)$/);
  return m ? { domain: m[1] } : null;
}

/**
 * Reconstruct a local-shape Assessment from a FHIR DiagnosticReport plus
 * its Observation resources. Used by the physician detail view when the
 * record is not in IndexedDB.
 */
export function bundleToAssessment(
  report: Record<string, any>,
  _observations: Record<string, any>[],
): Assessment {
  const identifiers = (report.identifier as Array<{ system?: string; value?: string }>) ?? [];
  const idVal = identifiers.find((i) => i.system === ID_SYSTEM)?.value ?? report.id;

  const conclusionCode = report.conclusionCode?.[0]?.coding?.[0]?.code as string | undefined;
  const category = snomedToCategory(conclusionCode);

  const extensions = (report.extension as Array<{ url?: string; valueDecimal?: number }>) ?? [];
  const confidence = extensions.find((x) => x.url === CONFIDENCE_EXT_URL)?.valueDecimal ?? 0;

  const period = report.effectivePeriod as { start?: string; end?: string } | undefined;
  const startedAtStr = period?.start ?? report.effectiveDateTime;
  const startedAt = startedAtStr ? new Date(startedAtStr) : new Date(0);
  const completedAt = period?.end ? new Date(period.end) : undefined;

  const conclusion = (report.conclusion as string | undefined) ?? '';
  const summary = stripLegacyConclusionPrefix(conclusion);

  const subjectRef = (report.subject as { reference?: string } | undefined)?.reference ?? '';
  const patientId = subjectRef.replace(/^Patient\//, '');

  const period2 = report.effectivePeriod as { start?: string; end?: string } | undefined;
  const assessmentDate = (period2?.start ?? report.effectiveDateTime ?? '').slice(0, 10);

  return {
    id: idVal,
    patientId,
    status: report.status === 'final' ? 'completed' : 'started',
    language: 'zh-TW',
    currentStep: 2,
    startedAt,
    completedAt,
    // Minimal reconstructed triage; per-domain detail is not round-tripped from
    // the summary Bundle in S1 (full FHIR profiling is an S2 concern).
    triageResult: {
      category,
      confidence,
      summary,
      domainScores: [],
      flaggedDomains: [],
      clinicalCutoffs: [],
      recommendations: [],
      incomplete: category === 'incomplete',
      completedDomains: 0,
      assessmentDate,
      ageGroup: '18-39',
    },
    fhirSubmitted: true,
    fhirDiagnosticReportId: report.id,
    createdAt: startedAt,
    updatedAt: completedAt ?? startedAt,
  } as Assessment;
}

/**
 * Look up one assessment on the FHIR server by its CDSA UUID.
 * Uses _include to fetch the referenced Observations in a single request.
 */
export async function fetchAssessmentFromFhir(
  id: string,
  client: FhirClient,
): Promise<Assessment | null> {
  const bundle = (await client.request(
    `DiagnosticReport?identifier=${ID_SYSTEM}|${id}&_include=DiagnosticReport:result`,
  )) as Bundle;
  const entries = bundle.entry ?? [];
  const reportEntry = entries.find((e) => e.resource.resourceType === 'DiagnosticReport');
  if (!reportEntry) return null;
  const observations = entries
    .filter((e) => e.resource.resourceType === 'Observation')
    .map((e) => e.resource as Record<string, any>);
  return bundleToAssessment(reportEntry.resource as Record<string, any>, observations);
}

/**
 * List CDSA assessments on the FHIR server.
 * - With `patientId`: scoped to that patient (per-patient history view).
 * - Without `patientId`: every CDSA report the user can read (workspace
 *   roster view, grouped by triage category).
 * Returns a summary row per DiagnosticReport — full metric values are
 * not loaded here; the detail page calls resolveAssessment(id) on click.
 */
export async function listAssessmentsFromFhir(
  patientId: string | undefined,
  client: FhirClient,
): Promise<AssessmentSummary[]> {
  const subjectClause = patientId ? `subject=Patient/${patientId}&` : '';
  const bundle = (await client.request(
    `DiagnosticReport?${subjectClause}` +
      `code=${CODE_SYSTEM}|func-assessment` +
      `&_sort=-date`,
  )) as Bundle;
  return (bundle.entry ?? []).map((e) => {
    const r = e.resource as Record<string, any>;
    const identifiers = (r.identifier as Array<{ system?: string; value?: string }>) ?? [];
    const idVal = identifiers.find((i) => i.system === ID_SYSTEM)?.value ?? (r.id as string);
    const period = r.effectivePeriod as { start?: string } | undefined;
    const dateStr = period?.start ?? (r.effectiveDateTime as string | undefined);
    const conclusionCode = r.conclusionCode?.[0]?.coding?.[0]?.code as string | undefined;
    const patientRef = (r.subject as { reference?: string } | undefined)?.reference ?? '';
    return {
      id: idVal,
      fhirReportId: r.id as string,
      patientRef,
      date: new Date(dateStr ?? 0),
      category: snomedToCategory(conclusionCode),
      summary: stripLegacyConclusionPrefix((r.conclusion as string) ?? ''),
    };
  });
}
