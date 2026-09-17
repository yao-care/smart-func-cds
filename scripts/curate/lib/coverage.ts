/**
 * coverage.ts — 衛教覆蓋率的純函式（無 IO，可單測）。
 *
 * 真相源是「`deriveFuncTriggers` 實際會產生的 trigger 組合」，不是
 * content-relevance.yaml 的 triggers 清單——後者可能整段漏掉某組合，
 * 拿它當分母會假性通過（geri 的 physical.pain 就踩過這個坑）。
 *
 * 對照 `src/lib/education/trigger-derivation.ts`：
 * - 域層：`func.domain.<domain>.<band>.<ageGroup>`，band 只有 low / moderate
 *   （high 不觸發衛教）。
 * - 分流層：`func.triage.<category>.<ageGroup>`，且 **normal 不會被派生**。
 */
import { IC_DOMAIN_NAMES, type RuntimeIndex } from '../../../src/lib/education/schemas.js';
import { AGE_GROUPS_ADULT } from '../../../src/lib/utils/age-groups.js';

/** 會觸發衛教的域分級（high 代表該域良好，不需衛教）。 */
export const BANDS_WITH_CONTENT = ['low', 'moderate'] as const;

/** 會被 `deriveFuncTriggers` 派生的分流類別（normal 被明確跳過）。 */
export const TRIAGE_CATEGORIES_WITH_CONTENT = ['observe', 'consult', 'incomplete'] as const;

/** 永遠不會被派生、卻可能殘留在 yaml 的 key（列出來以便清理）。 */
export const UNREACHABLE_TRIAGE_CATEGORIES = ['normal'] as const;

export function expectedTriggerKeys(): string[] {
  const keys: string[] = [];
  for (const domain of IC_DOMAIN_NAMES) {
    for (const band of BANDS_WITH_CONTENT) {
      for (const ageGroup of AGE_GROUPS_ADULT) {
        keys.push(`func.domain.${domain}.${band}.${ageGroup}`);
      }
    }
  }
  for (const category of TRIAGE_CATEGORIES_WITH_CONTENT) {
    for (const ageGroup of AGE_GROUPS_ADULT) {
      keys.push(`func.triage.${category}.${ageGroup}`);
    }
  }
  return keys;
}

export function unreachableTriggerKeys(): string[] {
  const keys: string[] = [];
  for (const category of UNREACHABLE_TRIAGE_CATEGORIES) {
    for (const ageGroup of AGE_GROUPS_ADULT) {
      keys.push(`func.triage.${category}.${ageGroup}`);
    }
  }
  return keys;
}

/**
 * build-content-index 產出的 triggers 區段。
 * 直接綁 `RuntimeIndex` 的型別，避免誤讀成 yaml 那邊的欄位名
 * （yaml 是 `articles`、runtime index 是 `articleSlugs`，寫錯會讓整批 trigger
 * 看起來像空的）。
 */
export type IndexTriggers = RuntimeIndex['triggers'];

export interface CoverageReport {
  expected: string[];
  /** yaml/index 根本沒有這個 key。 */
  missing: string[];
  /** key 存在，但文章與影片都是空的——使用者會看到空白的衛教區塊。 */
  empty: string[];
  /** 有文章但沒影片：非阻斷，待 `pnpm curate:videos` 補。 */
  videoGaps: string[];
  /** 派生不到、可從 yaml 移除的殘留 key。 */
  unreachablePresent: string[];
}

export function coverageReport(triggers: IndexTriggers): CoverageReport {
  const expected = expectedTriggerKeys();
  const missing: string[] = [];
  const empty: string[] = [];
  const videoGaps: string[] = [];

  for (const key of expected) {
    const row = triggers[key];
    if (!row) {
      missing.push(key);
      continue;
    }
    const videos = row.videoIds?.length ?? 0;
    const articles = row.articleSlugs?.length ?? 0;
    if (videos === 0 && articles === 0) empty.push(key);
    else if (videos === 0) videoGaps.push(key);
  }

  const unreachablePresent = unreachableTriggerKeys().filter(k => triggers[k] !== undefined);

  return { expected, missing, empty, videoGaps, unreachablePresent };
}

/**
 * 棘輪（ratchet）：現有缺口記在 baseline，只擋「新增的」缺口。
 * 已補齊卻還留在 baseline 的 key 也要報，否則 baseline 會鬆掉而沒人發現。
 */
export function ratchet(
  current: string[],
  baseline: string[],
): { regressions: string[]; staleBaseline: string[] } {
  const baseSet = new Set(baseline);
  const curSet = new Set(current);
  return {
    regressions: current.filter(k => !baseSet.has(k)).sort(),
    staleBaseline: baseline.filter(k => !curSet.has(k)).sort(),
  };
}
