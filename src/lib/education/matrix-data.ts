import { AGE_GROUPS_ADULT } from '$lib/utils/age-groups';
import { IC_DOMAIN_NAMES } from './schemas';
export { AGE_GROUPS_ADULT } from '$lib/utils/age-groups';

export const IC_DOMAINS = IC_DOMAIN_NAMES;
export type IcDomain = typeof IC_DOMAINS[number];
export type AgeGroupAdult = typeof AGE_GROUPS_ADULT[number];
export type MatrixKey = `${IcDomain}:${AgeGroupAdult}`;

export type MatrixCellData = {
  inapplicable: boolean;
  articleSlugs: string[];
  videoIds: string[];
};

export type MatrixData = Record<MatrixKey, MatrixCellData>;

type TriggerMap = Record<string, { videoIds: string[]; inapplicable: boolean; educationSlug?: string; articleSlugs?: string[] }>;

export function buildMatrixData(triggers: TriggerMap): MatrixData {
  const data: Record<string, MatrixCellData> = {};

  // Initialise all cells as applicable (empty → contributable).
  // Source of truth for inapplicability is src/data/education/content-relevance.yaml,
  // whose inapplicable section is compiled into func.domain triggers with
  // inapplicable:true; only those flip a cell back to inapplicable below.
  for (const domain of IC_DOMAINS) {
    for (const age of AGE_GROUPS_ADULT) {
      data[`${domain}:${age}`] = { inapplicable: false, articleSlugs: [], videoIds: [] };
    }
  }

  // Populate from func.domain.<domain>.<band>.<ageGroup> triggers only.
  // A single cell aggregates across both bands (low | moderate).
  for (const [trigger, entry] of Object.entries(triggers)) {
    const parts = trigger.split('.');
    // func . domain . <domain> . <band> . <ageGroup>
    if (parts[0] !== 'func' || parts[1] !== 'domain' || parts.length !== 5) continue;
    const cell = data[`${parts[2]}:${parts[4]}`];
    if (!cell) continue;
    if (entry.inapplicable) {
      cell.inapplicable = true;
      continue;
    }
    cell.videoIds = [...new Set([...cell.videoIds, ...entry.videoIds])];
    if (entry.articleSlugs && entry.articleSlugs.length) {
      cell.articleSlugs = [...new Set([...cell.articleSlugs, ...entry.articleSlugs])];
    } else if (entry.educationSlug) {
      cell.articleSlugs = [...new Set([...cell.articleSlugs, entry.educationSlug])];
    }
  }

  return data as MatrixData;
}
