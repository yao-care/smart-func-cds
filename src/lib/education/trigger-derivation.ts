import type { TriageResult } from '../../engine/func/triage';
import type { AgeGroupAdult } from '../utils/age-groups';
import { IC_DOMAIN_NAMES } from './schemas';

const KNOWN_DOMAINS = new Set<string>(IC_DOMAIN_NAMES);

/**
 * Derive content-relevance trigger strings from an IC triage result.
 * - Triage-level: `func.triage.<category>.<ageGroup>` (skip 'normal').
 * - Domain-level: `func.domain.<domain>.<band>.<ageGroup>` for each flagged
 *   (non-high) domain, using the domain's band (low | moderate).
 */
export function deriveFuncTriggers(
  triage: TriageResult,
  ageGroup: AgeGroupAdult,
): string[] {
  const triggers: string[] = [];
  if (triage.category !== 'normal') {
    triggers.push(`func.triage.${triage.category}.${ageGroup}`);
  }
  for (const d of triage.domainScores) {
    if (d.band === 'high') continue;
    if (!KNOWN_DOMAINS.has(d.domain)) {
      if (import.meta.env.DEV) {
        throw new Error(`Unknown IC domain: ${d.domain}. Update IC_DOMAIN_NAMES + yaml.`);
      }
      console.warn(`[trigger-derivation] Unknown domain: ${d.domain}, skipping`);
      continue;
    }
    triggers.push(`func.domain.${d.domain}.${d.band}.${ageGroup}`);
  }
  return triggers;
}
