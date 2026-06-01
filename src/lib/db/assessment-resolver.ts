import { db, type Assessment } from './schema';
import { fetchAssessmentFromFhir } from '../fhir/assessment-fetch';
import { getClient, refreshToken, isAuthorized } from '../fhir/client';

export type Source = 'idb' | 'fhir';
export type ResolveError = 'not_found' | 'token_expired' | 'forbidden' | 'network';

export type ResolveResult =
  | { ok: true; assessment: Assessment; source: Source }
  | { ok: false; error: ResolveError };

/**
 * Resolve an Assessment by id, regardless of which device produced it.
 *
 * 1. Hit local IndexedDB first (same-device case: clinic tablet or the subject's own device).
 *    A cached FHIR record (`_source: 'fhir-cache'`) is reported back with
 *    source='fhir' so the UI can show the data-origin badge correctly.
 * 2. Miss + authenticated → call the FHIR server; on success, persist the
 *    record into IDB tagged as `fhir-cache` so a second visit is instant.
 * 3. 401 from FHIR → refresh the token once and retry; persistent 401 is
 *    surfaced as `token_expired`. (fhirclient v2 does not refresh
 *    automatically on request() failure.)
 */
export async function resolveAssessment(id: string): Promise<ResolveResult> {
  const local = await db.assessments.get(id);
  if (local) {
    const source: Source = local._source === 'fhir-cache' ? 'fhir' : 'idb';
    return { ok: true, assessment: local, source };
  }

  if (!isAuthorized()) {
    return { ok: false, error: 'not_found' };
  }

  try {
    const assessment = await fetchAssessmentFromFhir(id, getClient());
    if (!assessment) return { ok: false, error: 'not_found' };
    await db.assessments.put({ ...assessment, _source: 'fhir-cache' });
    return { ok: true, assessment, source: 'fhir' };
  } catch (e) {
    const status = pickStatus(e);
    if (status === 401) {
      try {
        await refreshToken();
        const retry = await fetchAssessmentFromFhir(id, getClient());
        if (!retry) return { ok: false, error: 'not_found' };
        await db.assessments.put({ ...retry, _source: 'fhir-cache' });
        return { ok: true, assessment: retry, source: 'fhir' };
      } catch {
        return { ok: false, error: 'token_expired' };
      }
    }
    if (status === 403) return { ok: false, error: 'forbidden' };
    if (status === 404) return { ok: false, error: 'not_found' };
    return { ok: false, error: 'network' };
  }
}

function pickStatus(e: unknown): number | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const obj = e as { status?: number; response?: { status?: number } };
  return obj.status ?? obj.response?.status;
}
