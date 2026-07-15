import type { Assessment } from '../db/schema';
import type { TriageCategory } from '../../engine/func/triage';
import type { DomainScore } from '../../engine/func/scorer';
import { IC_DOMAIN_NAMES, type ICDomain } from '../education/schemas';
import { CODE_SYSTEM, ID_SYSTEM, CONFIDENCE_EXT_URL } from './cdsa-resources';

const IC_DOMAINS = new Set<string>(IC_DOMAIN_NAMES);

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

/** Minimal Observation shape the CDSA write produces and this module reads.
 *  Indicator-level detail is absent by design (see observationsToDomainScores). */
interface FhirObservation {
  identifier?: Array<{ system?: string; value?: string }>;
  code?: { text?: string };
  valueQuantity?: { value?: number };
  note?: Array<{ text?: string }>;
  interpretation?: Array<{ coding?: Array<{ code?: string }> }>;
}

/** Minimal DiagnosticReport shape this module reads. */
interface FhirDiagnosticReport {
  id?: string;
  identifier?: Array<{ system?: string; value?: string }>;
  status?: string;
  subject?: { reference?: string };
  effectivePeriod?: { start?: string; end?: string };
  effectiveDateTime?: string;
  extension?: Array<{ url?: string; valueDecimal?: number }>;
  conclusion?: string;
  conclusionCode?: Array<{ coding?: Array<{ code?: string }> }>;
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
 * Reconstruct per-domain scores from the assessment's Observation resources.
 *
 * The minimal write (buildAssessmentObservations) persists one Observation per
 * scored IC domain carrying: identifier "<assessmentId>::<domain>", score
 * (valueQuantity.value), band (note "band: <band>") and an L/N interpretation.
 * Indicator-level detail (contributingIndicators / missingIndicators) is NOT
 * persisted in this minimal write, so it defaults to 0 / [] on read-back.
 */
export function observationsToDomainScores(
  observations: FhirObservation[],
): DomainScore[] {
  const scores: DomainScore[] = [];
  for (const obs of observations) {
    // domain: prefer the project identifier "<assessmentId>::<domain>";
    // fall back to parsing code.text "Func IC <domain>".
    const idVal = obs.identifier?.find((i) => i.system === ID_SYSTEM)?.value;
    let domain = idVal?.includes('::') ? idVal.split('::')[1] : undefined;
    if (!domain) domain = parseObservationCode(obs.code?.text ?? '')?.domain;
    if (!domain || !IC_DOMAINS.has(domain)) continue;

    const value = obs.valueQuantity?.value;
    if (typeof value !== 'number') continue;

    // band: authoritative from note "band: <band>"; fall back to L/N interpretation
    // (N → high; L is moderate-or-low, degrade to 'low' when the note is absent).
    const noteText = obs.note?.[0]?.text ?? '';
    const bandMatch = noteText.match(/band:\s*(high|moderate|low)/);
    let band: DomainScore['band'];
    if (bandMatch) {
      band = bandMatch[1] as DomainScore['band'];
    } else {
      const interp = obs.interpretation?.[0]?.coding?.[0]?.code;
      band = interp === 'N' ? 'high' : 'low';
    }

    scores.push({
      domain: domain as ICDomain,
      score: value,
      band,
      contributingIndicators: 0, // not persisted in minimal FHIR write
      missingIndicators: [],
    });
  }
  return scores;
}

/**
 * Reconstruct a local-shape Assessment from a FHIR DiagnosticReport plus
 * its Observation resources. Used by the physician detail view when the
 * record is not in IndexedDB. Per-domain scores are round-tripped from the
 * Observations (domain/score/band); indicator-level detail is not persisted.
 */
export function bundleToAssessment(
  report: FhirDiagnosticReport,
  observations: FhirObservation[],
): Assessment {
  const identifiers = report.identifier ?? [];
  const idVal = identifiers.find((i) => i.system === ID_SYSTEM)?.value ?? report.id ?? '';

  const conclusionCode = report.conclusionCode?.[0]?.coding?.[0]?.code;
  const category = snomedToCategory(conclusionCode);

  const extensions = report.extension ?? [];
  const confidence = extensions.find((x) => x.url === CONFIDENCE_EXT_URL)?.valueDecimal ?? 0;

  const period = report.effectivePeriod;
  const startedAtStr = period?.start ?? report.effectiveDateTime;
  const startedAt = startedAtStr ? new Date(startedAtStr) : new Date(0);
  const completedAt = period?.end ? new Date(period.end) : undefined;

  const conclusion = report.conclusion ?? '';
  const summary = stripLegacyConclusionPrefix(conclusion);

  const subjectRef = report.subject?.reference ?? '';
  const patientId = subjectRef.replace(/^Patient\//, '');

  const assessmentDate = (period?.start ?? report.effectiveDateTime ?? '').slice(0, 10);

  // Per-domain round-trip from the Observation resources (S2). Indicator-level
  // detail isn't persisted in the minimal write, so it defaults to 0 / [].
  const domainScores = observationsToDomainScores(observations);
  const flaggedDomains = domainScores.filter((d) => d.band !== 'high').map((d) => d.domain);

  return {
    id: idVal,
    patientId,
    status: report.status === 'final' ? 'completed' : 'started',
    language: 'zh-TW',
    currentStep: 2,
    startedAt,
    completedAt,
    // Triage reconstructed from the report + per-domain Observations. Indicator
    // cutoffs / recommendations and ageGroup are not persisted in the minimal
    // FHIR write, so they stay empty / defaulted on read-back.
    triageResult: {
      category,
      confidence,
      summary,
      domainScores,
      flaggedDomains,
      clinicalCutoffs: [],
      recommendations: [],
      incomplete: category === 'incomplete',
      completedDomains: domainScores.length,
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
    .map((e) => e.resource as FhirObservation);
  return bundleToAssessment(reportEntry.resource as FhirDiagnosticReport, observations);
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
    const r = e.resource as FhirDiagnosticReport;
    const identifiers = r.identifier ?? [];
    const idVal = identifiers.find((i) => i.system === ID_SYSTEM)?.value ?? r.id ?? '';
    const dateStr = r.effectivePeriod?.start ?? r.effectiveDateTime;
    const conclusionCode = r.conclusionCode?.[0]?.coding?.[0]?.code;
    const patientRef = r.subject?.reference ?? '';
    return {
      id: idVal,
      fhirReportId: r.id ?? '',
      patientRef,
      date: new Date(dateStr ?? 0),
      category: snomedToCategory(conclusionCode),
      summary: stripLegacyConclusionPrefix(r.conclusion ?? ''),
    };
  });
}
