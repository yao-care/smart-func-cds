# S1 — Pediatric → IC-inspired Adult Functional Health: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the pediatric CDSA assessment engine into an IC-inspired adult functional health assessment system, with new questionnaire schema, scoring engine, triage, 5-axis radar, FHIR write-back, and patient-facing UI shell — pediatric modules retired in-place.

**Architecture:** Schema-driven engine in `src/engine/func/` (questionnaire / scorer / triage / radar-scoring / objective-tests / recommendations / utils), Likert + objective indicator discriminated union, 5 IC domains × ~50 questions + 2 cognition timing tests, FHIR R4 transaction Bundle write-back with Device + Provenance for patient-generated data, 8 local CodeSystems, charter §0.7 traceability programme.

**Tech Stack:** TypeScript strict mode, Svelte 5 runes, Dexie 4 IndexedDB, FHIR R4, Zod schemas, Vitest, Playwright (smoke), pnpm.

**Anchors:**
- Charter: [`docs/superpowers/specs/2026-05-28-smart-func-cds-charter.md`](../specs/2026-05-28-smart-func-cds-charter.md)
- S1 Spec: [`docs/superpowers/specs/2026-05-28-s1-core-schema-and-step1-design.md`](../specs/2026-05-28-s1-core-schema-and-step1-design.md)
- Research: [`docs/superpowers/research/2026-05-28-who-ic-framework-research.md`](../research/2026-05-28-who-ic-framework-research.md)

---

## File Structure

### New files

```
src/engine/func/
  questionnaire.ts          # Indicator schema (LikertIndicator | ObjectiveIndicator), YAML loader
  scorer.ts                 # scoreLikertIndicator / scoreObjectiveIndicator / scoreDomain / scoreAssessment
  triage.ts                 # computeTriage（4 類分流 + confidence + recommendations）
  radar-scoring.ts          # buildRadarData
  objective-tests.ts        # 反應時間 + TMT-A 量測 + 結果計時
  recommendations.ts        # 建議科別對照表（資料）
  utils.ts                  # zToPercentile + median + reverseScoreOf + isValidLoinc helper
  __tests__/                # 對應單元測試

src/lib/fhir/
  code-systems.ts           # 8 個 IC CodeSystem URI 常數
  func-submit.ts            # TriageResult → Bundle → POST（含 Device + Provenance fallback）
  func-resources.ts         # 個別 FHIR resource builders（Questionnaire/QR/Obs/Provenance/Device）

src/data/questionnaire/
  indicators.yaml           # Layer 2 indicator 定義（取代 questions.json）

public/fhir/
  Questionnaire/ic-screen-v1.json
  CodeSystem/ic-domain-score.json
  CodeSystem/ic-triage-category.json
  CodeSystem/ic-domain-band.json
  CodeSystem/ic-indicator.json
  CodeSystem/ic-score-component.json
  CodeSystem/ic-subscale.json
  CodeSystem/ic-clinical-cutoff.json
  CodeSystem/ic-cutoff-severity.json

scripts/
  validate-indicators.ts    # prebuild 守門

src/components/assess/
  PatientProfile.svelte     # 從 ChildProfile.svelte git mv 後重寫

tests/engine/func/          # 新測試目錄
  scorer.test.ts
  triage.test.ts
  radar-scoring.test.ts
  objective-tests.test.ts
  questionnaire.test.ts
  end-to-end-scoring.test.ts
  voice-analysis.test.ts    # git mv，S1 暫不啟用
  objective-tests.test.ts   # git mv 自 behavior-analysis.test.ts
```

### Modified files

```
src/lib/education/schemas.ts                       # 刪 CDSA_/CDSS_/SEVERITY_NAMES，加 IC_DOMAIN_NAMES / funcTriageEntrySchema / funcDomainEntrySchema
src/lib/utils/age-groups.ts                        # 整檔重寫
src/lib/db/schema.ts                               # children→patients, DB 名 smart-func-cds, triageResult/RecommendationCategory enum
src/lib/db/recommendations.ts                      # enum cascade
src/lib/education/{trigger-derivation,matrix-data,video-lookup,age-fallback}.ts   # enum cascade
src/lib/fhir/{cdsa-resources,cdsa-submit,assessment-fetch}.ts   # IC code 格式
src/lib/stores/assessment.svelte.ts                # imports + state 結構
scripts/build-questionnaire-applicability.ts       # CDSA hardcode → IC
scripts/curate/keywords.json                       # 兒科 keywords → 成人
src/data/education/content-relevance.yaml          # 74 cdsa.* trigger → 30 條 IC stub
src/components/assess/AssessmentShell.svelte       # 模組陣列
src/components/assess/QuestionnaireModule.svelte   # 5 IC domain + objective tests
src/components/assess/RadarChart.svelte            # 6 軸 → 5 軸
src/components/assess/ResultView.svelte            # category enum + imports
src/components/assess/ResultViewWrapper.svelte     # ageGroupCDSA → ageGroupAdult
src/components/assess/AssessmentPdfReport.svelte   # ageInMonths → ageInYears
src/components/assess/AssessmentHistory.svelte     # age display
src/components/assess/EducationMatch.svelte        # category enum
src/components/patient/ResultDetail.svelte         # ageGroupCDSA + childBirthDate
src/components/patient/ReportExport.svelte         # 兒科文案
src/components/workspace/{AssessmentsTab,GuideTab}.svelte   # Category type + childId
src/components/settings/{RecommendationsManager,NormsManager}.svelte   # enum
src/pages/education/index.astro                    # CDSA_DOMAINS / AGE_GROUPS_CDSA cascade
package.json                                       # prebuild chain 加 validate-indicators
```

### Deleted files

```
src/engine/cdsa/drawing-analysis.ts
src/engine/cdsa/gross-motor-analysis.ts
src/engine/cdsa/card-selector.ts
src/engine/cdsa/assessment-analyzer.ts
src/engine/cdsa/triage.ts                        # 被 func/triage.ts 取代
src/engine/cdsa/radar-scoring.ts                 # 被 func/radar-scoring.ts 取代
public/models/drawing-classifier.onnx
src/data/cards/index.json
src/data/baselines/pediatric-baselines.json
src/data/rules/pediatric-default.yaml
src/data/questionnaire/questions.json            # 由 indicators.yaml 取代
src/components/assess/DrawingModule.svelte
src/components/assess/GameModule.svelte
src/components/assess/VideoModule.svelte
tests/engine/drawing-analysis.test.ts
tests/engine/card-selector.test.ts
tests/engine/assessment-analyzer.test.ts
tests/components/ChildProfile.test.ts            # 由 PatientProfile.test.ts 取代
```

### Git mv (保留 history)

```
src/engine/cdsa/behavior-analysis.ts             → src/engine/func/objective-tests.ts
src/engine/cdsa/voice-analysis.ts                → src/engine/func/voice-analysis.ts (S1 暫不啟用)
src/components/assess/ChildProfile.svelte        → src/components/assess/PatientProfile.svelte
tests/engine/behavior-analysis.test.ts           → tests/engine/func/objective-tests.test.ts
tests/engine/voice-analysis.test.ts              → tests/engine/func/voice-analysis.test.ts
tests/engine/radar-scoring.test.ts               → tests/engine/func/radar-scoring.test.ts
tests/engine/triage.test.ts                      → tests/engine/func/triage.test.ts
```

---

## Phase 0: Coexisting Enum Stubs（Phase 0 結束時 pnpm check 必須全綠）

### Task 0.1: 新增 IC_DOMAIN_NAMES 與 ICDomain 型別於 schemas.ts

**Files:**
- Modify: `src/lib/education/schemas.ts`

- [ ] **Step 1: Read 現有 schemas.ts 找出 `CDSA_DOMAIN_NAMES` 區段**

Run: `grep -n "CDSA_DOMAIN_NAMES\|CDSS_INDICATOR_NAMES" src/lib/education/schemas.ts`
預期：找到既有 export 與 z.enum 引用點。

- [ ] **Step 2: 在 `CDSA_DOMAIN_NAMES` 既有區段下方 append 新 enum（共存）**

在 `src/lib/education/schemas.ts` 緊接 `CDSA_DOMAIN_NAMES` 後新增：

```ts
// --- IC domain (smart-func-cds 成人功能健康評估) ---
export const IC_DOMAIN_NAMES = [
  'vitality',      // 身體活力
  'locomotion',    // 行動功能
  'cognition',     // 認知功能
  'psychological', // 心理功能
  'sensory',       // 感官功能
] as const;
export type ICDomain = typeof IC_DOMAIN_NAMES[number];
```

- [ ] **Step 3: Run `pnpm check`**

預期：全綠（純 additive，無破壞既有 type）。

- [ ] **Step 4: Commit**

```bash
git add src/lib/education/schemas.ts
git commit -m "feat(schemas): add IC_DOMAIN_NAMES enum coexisting with CDSA"
```

---

### Task 0.2: 新增 AGE_GROUPS_ADULT 與 AgeGroupAdult 於 age-groups.ts

**Files:**
- Modify: `src/lib/utils/age-groups.ts`

- [ ] **Step 1: 在檔尾 append 新 const（共存）**

```ts
// --- Adult age groups (smart-func-cds) ---
export const ADULT_AGE_MIN = 18 as const;
export const AGE_GROUPS_ADULT = ['18-39', '40-54', '55-64'] as const;
export type AgeGroupAdult = typeof AGE_GROUPS_ADULT[number];

export function ageInYears(birthDate: string | Date): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  return Math.max(0, years);
}

export function isAdult(birthDate: string | Date): boolean {
  return ageInYears(birthDate) >= ADULT_AGE_MIN;
}

export function ageGroupAdult(birthDate: string | Date): AgeGroupAdult {
  const y = ageInYears(birthDate);
  if (y < 18) throw new Error(`Below adult age: ${y}`);
  if (y <= 39) return '18-39';
  if (y <= 54) return '40-54';
  // 55+ 全歸 55-64（charter §0.1 + spec §1.2: 65+ 仍可填，但結果頁 advisory）
  return '55-64';
}

export function isWithinValidatedRange(birthDate: string | Date): boolean {
  const y = ageInYears(birthDate);
  return y >= 18 && y <= 64;
}
```

- [ ] **Step 2: 撰寫單元測試**

Create: `tests/utils/age-groups-adult.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { ageInYears, isAdult, ageGroupAdult, isWithinValidatedRange } from '../../src/lib/utils/age-groups';

describe('adult age helpers', () => {
  it('ageInYears: 1990-01-15 in 2026', () => {
    expect(ageInYears('1990-01-15')).toBeGreaterThanOrEqual(35);
  });

  it('isAdult: 17 yrs false, 18 yrs true', () => {
    const today = new Date();
    const y17 = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate()).toISOString();
    const y18 = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString();
    expect(isAdult(y17)).toBe(false);
    expect(isAdult(y18)).toBe(true);
  });

  it('ageGroupAdult: 18-39 / 40-54 / 55-64 boundaries', () => {
    const today = new Date();
    const mkBirth = (yrsAgo: number) =>
      new Date(today.getFullYear() - yrsAgo, today.getMonth(), today.getDate()).toISOString();
    expect(ageGroupAdult(mkBirth(18))).toBe('18-39');
    expect(ageGroupAdult(mkBirth(39))).toBe('18-39');
    expect(ageGroupAdult(mkBirth(40))).toBe('40-54');
    expect(ageGroupAdult(mkBirth(54))).toBe('40-54');
    expect(ageGroupAdult(mkBirth(55))).toBe('55-64');
    expect(ageGroupAdult(mkBirth(64))).toBe('55-64');
    expect(ageGroupAdult(mkBirth(65))).toBe('55-64');  // 65+ 歸 55-64，UI advisory 處理
  });

  it('isWithinValidatedRange: 17 false, 18 true, 64 true, 65 false', () => {
    const today = new Date();
    const mkBirth = (yrsAgo: number) =>
      new Date(today.getFullYear() - yrsAgo, today.getMonth(), today.getDate()).toISOString();
    expect(isWithinValidatedRange(mkBirth(17))).toBe(false);
    expect(isWithinValidatedRange(mkBirth(18))).toBe(true);
    expect(isWithinValidatedRange(mkBirth(64))).toBe(true);
    expect(isWithinValidatedRange(mkBirth(65))).toBe(false);
  });
});
```

- [ ] **Step 3: Run `pnpm vitest run tests/utils/age-groups-adult.test.ts`**

預期：4 tests pass。

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/age-groups.ts tests/utils/age-groups-adult.test.ts
git commit -m "feat(age-groups): add adult age helpers coexisting with CDSA"
```

---

### Task 0.3: 新增 funcTriageEntrySchema / funcDomainEntrySchema（schemas.ts append）

**Files:**
- Modify: `src/lib/education/schemas.ts`

- [ ] **Step 1: 在 CDSA schema 既有區段下方 append IC 版本**

```ts
// --- IC trigger schemas (共存於舊 CDSA schema) ---
const IC_DOMAIN_ENUM = z.enum(IC_DOMAIN_NAMES);
const IC_AGE_GROUP_ENUM = z.enum(AGE_GROUPS_ADULT);
const IC_BAND_ENUM = z.enum(['low', 'moderate']);
const IC_TRIAGE_CATEGORY_ENUM = z.enum(['normal', 'observe', 'consult', 'incomplete']);

export const funcTriageEntrySchema = z.object({
  trigger: z.string(),
  category: z.literal('triage'),
  triageCategory: IC_TRIAGE_CATEGORY_ENUM,
  ageGroup: IC_AGE_GROUP_ENUM,
  educationSlug: z.string().optional(),
  inapplicable: z.literal(true).optional(),
  videoIds: videoIdsField,
}).refine(
  d => d.trigger === `func.triage.${d.triageCategory}.${d.ageGroup}`,
  { message: 'trigger 字串與 triageCategory + ageGroup 不一致', path: ['trigger'] },
);

export const funcDomainEntrySchema = z.object({
  trigger: z.string(),
  category: z.literal('domain'),
  domain: IC_DOMAIN_ENUM,
  band: IC_BAND_ENUM,
  ageGroup: IC_AGE_GROUP_ENUM,
  educationSlug: z.string().optional(),
  inapplicable: z.literal(true).optional(),
  videoIds: videoIdsField,
}).refine(
  d => d.trigger === `func.domain.${d.domain}.${d.band}.${d.ageGroup}`,
  { message: 'trigger 字串與 domain + band + ageGroup 不一致', path: ['trigger'] },
);
```

注意 `AGE_GROUPS_ADULT` 需從 `../utils/age-groups` import；若已有 `AGE_GROUPS_CDSA` import，append 即可。

- [ ] **Step 2: Run `pnpm check`**

預期：全綠。

- [ ] **Step 3: Commit**

```bash
git add src/lib/education/schemas.ts
git commit -m "feat(schemas): add funcTriageEntrySchema / funcDomainEntrySchema coexisting with CDSA"
```

---

## Phase 1: 新 func/ 引擎模組（TDD）

### Task 1.1: utils.ts — zToPercentile + median + reverseScoreOf

**Files:**
- Create: `src/engine/func/utils.ts`
- Test: `tests/engine/func/utils.test.ts`

- [ ] **Step 1: 撰寫測試**

```ts
// tests/engine/func/utils.test.ts
import { describe, it, expect } from 'vitest';
import { zToPercentile, median, reverseScoreOf, clamp } from '../../../src/engine/func/utils';

describe('zToPercentile (Abramowitz 26.2.17)', () => {
  it('z=0 → 0.5', () => expect(zToPercentile(0)).toBeCloseTo(0.5, 4));
  it('z=1.96 → ~0.975', () => expect(zToPercentile(1.96)).toBeCloseTo(0.975, 3));
  it('z=-1.96 → ~0.025', () => expect(zToPercentile(-1.96)).toBeCloseTo(0.025, 3));
  it('z=4 → near 1.0', () => expect(zToPercentile(4)).toBeGreaterThan(0.9999));
  it('z=-4 → near 0', () => expect(zToPercentile(-4)).toBeLessThan(0.0001));
});

describe('median', () => {
  it('odd length', () => expect(median([1, 3, 5, 2, 4])).toBe(3));
  it('even length: 兩中位數平均', () => expect(median([1, 2, 3, 4])).toBe(2.5));
  it('single', () => expect(median([42])).toBe(42));
});

describe('reverseScoreOf', () => {
  it('PSS-4 q2 raw=3 → effective=1 (maxScore=4, minScore=0)', () => {
    expect(reverseScoreOf(3, 4, 0)).toBe(1);
  });
  it('PSS-4 q3 raw=0 → effective=4', () => {
    expect(reverseScoreOf(0, 4, 0)).toBe(4);
  });
  it('BAT-12 raw=5 → effective=1 (maxScore=5, minScore=1)', () => {
    expect(reverseScoreOf(5, 5, 1)).toBe(1);
  });
});

describe('clamp', () => {
  it('within bounds', () => expect(clamp(5, 0, 10)).toBe(5));
  it('below', () => expect(clamp(-3, 0, 10)).toBe(0));
  it('above', () => expect(clamp(15, 0, 10)).toBe(10));
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run tests/engine/func/utils.test.ts`
Expected: FAIL with module not found。

- [ ] **Step 3: Implement utils.ts**

```ts
// src/engine/func/utils.ts

/**
 * Standard normal CDF approximation (Abramowitz & Stegun 26.2.17).
 * Max abs error ~7.5e-8, accurate for all real z.
 */
export function zToPercentile(z: number): number {
  if (z === 0) return 0.5;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-z * z / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median: empty array');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Reverse-scored Likert item: raw=high → effective=low. */
export function reverseScoreOf(raw: number, maxScore: number, minScore: number): number {
  return maxScore - raw + minScore;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `pnpm vitest run tests/engine/func/utils.test.ts`
Expected: 13 tests pass。

- [ ] **Step 5: Commit**

```bash
git add src/engine/func/utils.ts tests/engine/func/utils.test.ts
git commit -m "feat(func): add utils (zToPercentile/median/reverseScoreOf/clamp) + tests"
```

---

### Task 1.2: questionnaire.ts — Indicator schema (discriminated union + Zod runtime)

**Files:**
- Create: `src/engine/func/questionnaire.ts`
- Test: `tests/engine/func/questionnaire.test.ts`

- [ ] **Step 1: 撰寫測試**

```ts
// tests/engine/func/questionnaire.test.ts
import { describe, it, expect } from 'vitest';
import {
  INDICATOR_KINDS, INDICATOR_STYLES, DIRECTION_KINDS, LICENSE_KINDS,
  likertIndicatorSchema, objectiveIndicatorSchema, indicatorSchema,
} from '../../../src/engine/func/questionnaire';

describe('constants', () => {
  it('INDICATOR_KINDS has both', () => {
    expect(INDICATOR_KINDS).toContain('likert');
    expect(INDICATOR_KINDS).toContain('objective');
  });
  it('LICENSE_KINDS includes study-developed', () => {
    expect(LICENSE_KINDS).toContain('study-developed');
  });
});

describe('likertIndicatorSchema', () => {
  it('parses valid PHQ-2-like indicator', () => {
    const parsed = likertIndicatorSchema.parse({
      kind: 'likert',
      id: 'psychological.depression',
      domain: 'psychological',
      label: '憂鬱篩檢',
      style: 'symptom',
      direction: 'higher_is_worse',
      weight: 1.0,
      license: 'public-domain',
      loincCode: '55757-9',
      maxScore: 3,
      questions: [
        { id: 'psychological.depression.q1', text: 'q1', options: [{ label: '無', score: 0 }] },
        { id: 'psychological.depression.q2', text: 'q2', options: [{ label: '無', score: 0 }] },
      ],
      minCompletionPolicy: 1.0,
      clinicalCutoff: {
        threshold: 3, comparator: '>=', flagLabel: 'positive-depression-screen',
        severity: 'advisory', citation: 'Kroenke 2003',
      },
    });
    expect(parsed.kind).toBe('likert');
  });

  it('rejects commercial license', () => {
    expect(() => likertIndicatorSchema.parse({
      kind: 'likert', id: 'x.y', domain: 'vitality', label: 'l',
      style: 'capacity', direction: 'higher_is_better', weight: 1, license: 'commercial',
      maxScore: 3, questions: [{ id: 'x.y.q1', text: 't', options: [] }],
    })).toThrow();
  });

  it('rejects maxScore > 10 (sane bound)', () => {
    expect(() => likertIndicatorSchema.parse({
      kind: 'likert', id: 'x.y', domain: 'vitality', label: 'l',
      style: 'capacity', direction: 'higher_is_better', weight: 1, license: 'public-domain',
      maxScore: 100, questions: [{ id: 'x.y.q1', text: 't', options: [] }],
    })).toThrow();
  });
});

describe('objectiveIndicatorSchema', () => {
  it('parses reaction-time test', () => {
    const parsed = objectiveIndicatorSchema.parse({
      kind: 'objective',
      id: 'cognition.processing_speed',
      domain: 'cognition',
      label: '處理速度',
      style: 'capacity',
      direction: 'higher_is_worse',
      weight: 1.0,
      license: 'research-open-noncommercial',
      test: {
        type: 'reaction-time',
        paradigm: 'simple-visual',
        trials: 20, warmupTrials: 5,
        validRangeMs: { min: 100, max: 2000 },
        norms: {
          '18-39': { mean: 350, std: 80, citation: 'NIH Toolbox' },
          '40-54': null,
          '55-64': null,
        },
      },
    });
    expect(parsed.test.type).toBe('reaction-time');
  });

  it('parses tmt-a test', () => {
    const parsed = objectiveIndicatorSchema.parse({
      kind: 'objective',
      id: 'cognition.executive_function',
      domain: 'cognition',
      label: 'TMT-A',
      style: 'capacity',
      direction: 'higher_is_worse',
      weight: 1.0,
      license: 'research-open-noncommercial',
      test: {
        type: 'tmt-a',
        targetCount: 25,
        administration: 'browser-mouse',
        norms: { '18-39': null, '40-54': null, '55-64': null },
      },
    });
    expect(parsed.test.type).toBe('tmt-a');
  });
});

describe('indicatorSchema (discriminated union)', () => {
  it('routes by kind', () => {
    const lik = indicatorSchema.parse({
      kind: 'likert', id: 'vitality.sleep_quality', domain: 'vitality',
      label: 's', style: 'capacity', direction: 'higher_is_better', weight: 1,
      license: 'public-domain', maxScore: 3,
      questions: [{ id: 'vitality.sleep_quality.q1', text: 't', options: [] }],
    });
    expect(lik.kind).toBe('likert');
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Expected: module not found。

- [ ] **Step 3: Implement questionnaire.ts**

```ts
// src/engine/func/questionnaire.ts
import { z } from 'astro/zod';
import { IC_DOMAIN_NAMES, type ICDomain } from '../../lib/education/schemas';
import { AGE_GROUPS_ADULT, type AgeGroupAdult } from '../../lib/utils/age-groups';

export const INDICATOR_KINDS = ['likert', 'objective'] as const;
export type IndicatorKind = typeof INDICATOR_KINDS[number];

export const INDICATOR_STYLES = ['capacity', 'symptom'] as const;
export type IndicatorStyle = typeof INDICATOR_STYLES[number];

export const DIRECTION_KINDS = ['higher_is_better', 'higher_is_worse'] as const;
export type Direction = typeof DIRECTION_KINDS[number];

export const LICENSE_KINDS = [
  'public-domain', 'cc-by', 'cc-by-sa', 'cc-by-nc-sa',
  'research-open-noncommercial', 'study-developed', 'commercial',
] as const;
export type License = typeof LICENSE_KINDS[number];

const loincRegex = /^\d{1,5}-\d$/;

export const likertQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  reverseScored: z.boolean().optional(),
  loincCode: z.string().regex(loincRegex).nullable().optional(),
  options: z.array(z.object({
    label: z.string(),
    score: z.number(),
  })),
});

export const clinicalCutoffSchema = z.object({
  threshold: z.number(),
  comparator: z.enum(['>=', '<=']),
  flagLabel: z.string().min(1),
  severity: z.enum(['consult', 'advisory']),
  citation: z.string().min(1),
});

export const likertSubScaleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  questionIds: z.array(z.string()).min(1),
  weight: z.number().nonnegative().optional(),
  clinicalCutoff: clinicalCutoffSchema.optional(),
});

const baseIndicatorFields = {
  id: z.string().regex(/^[a-z_]+\.[a-z_]+$/, 'id must be <domain>.<name>'),
  domain: z.enum(IC_DOMAIN_NAMES),
  label: z.string().min(1),
  style: z.enum(INDICATOR_STYLES),
  direction: z.enum(DIRECTION_KINDS),
  weight: z.number().nonnegative(),
  ageApplicability: z.array(z.enum(AGE_GROUPS_ADULT)).optional(),
  license: z.enum(LICENSE_KINDS).refine(l => l !== 'commercial', { message: 'commercial license forbidden' }),
  loincCode: z.string().regex(loincRegex).nullable().optional(),
};

export const likertIndicatorSchema = z.object({
  kind: z.literal('likert'),
  ...baseIndicatorFields,
  maxScore: z.number().int().positive().max(10),
  minScore: z.number().int().nonnegative().optional(),
  questions: z.array(likertQuestionSchema).min(1),
  subScales: z.array(likertSubScaleSchema).optional(),
  clinicalCutoff: clinicalCutoffSchema.optional(),
  minCompletionPolicy: z.number().min(0).max(1).optional(),
}).refine(d => d.maxScore > (d.minScore ?? 0), { message: 'maxScore must > minScore' });

const normSpecSchema = z.object({
  mean: z.number(),
  std: z.number().positive(),
  citation: z.string().min(1),
});

const reactionTimeTestSchema = z.object({
  type: z.literal('reaction-time'),
  paradigm: z.literal('simple-visual'),
  trials: z.number().int().positive(),
  warmupTrials: z.number().int().nonnegative(),
  validRangeMs: z.object({ min: z.number().positive(), max: z.number().positive() }),
  norms: z.object({
    '18-39': normSpecSchema.nullable(),
    '40-54': normSpecSchema.nullable(),
    '55-64': normSpecSchema.nullable(),
  }),
});

const tmtATestSchema = z.object({
  type: z.literal('tmt-a'),
  targetCount: z.literal(25),
  administration: z.enum(['browser-mouse', 'browser-touch']),
  norms: z.object({
    '18-39': normSpecSchema.nullable(),
    '40-54': normSpecSchema.nullable(),
    '55-64': normSpecSchema.nullable(),
  }),
});

export const objectiveIndicatorSchema = z.object({
  kind: z.literal('objective'),
  ...baseIndicatorFields,
  test: z.discriminatedUnion('type', [reactionTimeTestSchema, tmtATestSchema]),
});

export const indicatorSchema = z.discriminatedUnion('kind', [
  likertIndicatorSchema,
  objectiveIndicatorSchema,
]);

export type LikertQuestion = z.infer<typeof likertQuestionSchema>;
export type LikertSubScale = z.infer<typeof likertSubScaleSchema>;
export type ClinicalCutoff = z.infer<typeof clinicalCutoffSchema>;
export type LikertIndicator = z.infer<typeof likertIndicatorSchema>;
export type ObjectiveIndicator = z.infer<typeof objectiveIndicatorSchema>;
export type Indicator = z.infer<typeof indicatorSchema>;
export type NormSpec = z.infer<typeof normSpecSchema>;
export type ObjectiveTest = z.infer<typeof reactionTimeTestSchema> | z.infer<typeof tmtATestSchema>;
```

- [ ] **Step 4: Run to verify PASS**

Run: `pnpm vitest run tests/engine/func/questionnaire.test.ts`
Expected: 8 tests pass。

- [ ] **Step 5: Commit**

```bash
git add src/engine/func/questionnaire.ts tests/engine/func/questionnaire.test.ts
git commit -m "feat(func): add Indicator discriminated union schema + zod validation"
```

---

### Task 1.3: scorer.ts — scoreLikertIndicator（BAT-12 公式驗算 critical）

**Files:**
- Create: `src/engine/func/scorer.ts`（部分）
- Test: `tests/engine/func/scorer.test.ts`

- [ ] **Step 1: 撰寫測試（含 BAT-12 公式驗算 critical 案例）**

```ts
// tests/engine/func/scorer.test.ts
import { describe, it, expect } from 'vitest';
import type { LikertIndicator } from '../../../src/engine/func/questionnaire';
import { scoreLikertIndicator } from '../../../src/engine/func/scorer';

const PHQ2: LikertIndicator = {
  kind: 'likert', id: 'psychological.depression', domain: 'psychological',
  label: 'PHQ-2', style: 'symptom', direction: 'higher_is_worse',
  weight: 1.0, license: 'public-domain', loincCode: '55757-9',
  maxScore: 3,
  questions: [
    { id: 'psychological.depression.q1', text: 'q1', options: [] },
    { id: 'psychological.depression.q2', text: 'q2', options: [] },
  ],
  minCompletionPolicy: 1.0,
  clinicalCutoff: {
    threshold: 3, comparator: '>=', flagLabel: 'positive-depression-screen',
    severity: 'advisory', citation: 'Kroenke 2003',
  },
};

const BAT12: LikertIndicator = {
  kind: 'likert', id: 'psychological.burnout', domain: 'psychological',
  label: 'BAT-12', style: 'symptom', direction: 'higher_is_worse',
  weight: 1.0, license: 'cc-by-nc-sa',
  maxScore: 5, minScore: 1,
  questions: Array.from({ length: 12 }, (_, i) => ({
    id: `psychological.burnout.q${i + 1}`, text: `q${i + 1}`, options: [],
  })),
  minCompletionPolicy: 1.0,
  subScales: [
    { id: 'bat12.exhaustion', label: 'exhaustion',
      questionIds: ['psychological.burnout.q1','psychological.burnout.q2','psychological.burnout.q3'],
      clinicalCutoff: { threshold: 2.96, comparator: '>=', flagLabel: 'bat12-exhaustion-redzone', severity: 'advisory', citation: 'Schaufeli 2020' },
    },
    { id: 'bat12.mental_distance', label: 'mental_distance',
      questionIds: ['psychological.burnout.q4','psychological.burnout.q5','psychological.burnout.q6'] },
    { id: 'bat12.cognitive_impairment', label: 'cognitive_impairment',
      questionIds: ['psychological.burnout.q7','psychological.burnout.q8','psychological.burnout.q9'] },
    { id: 'bat12.emotional_impairment', label: 'emotional_impairment',
      questionIds: ['psychological.burnout.q10','psychological.burnout.q11','psychological.burnout.q12'] },
  ],
};

const PSS4: LikertIndicator = {
  kind: 'likert', id: 'psychological.stress', domain: 'psychological',
  label: 'PSS-4', style: 'symptom', direction: 'higher_is_worse',
  weight: 1.0, license: 'research-open-noncommercial',
  maxScore: 4,
  questions: [
    { id: 'psychological.stress.q1', text: 'q1', reverseScored: false, options: [] },
    { id: 'psychological.stress.q2', text: 'q2', reverseScored: true, options: [] },
    { id: 'psychological.stress.q3', text: 'q3', reverseScored: true, options: [] },
    { id: 'psychological.stress.q4', text: 'q4', reverseScored: false, options: [] },
  ],
  minCompletionPolicy: 1.0,
  clinicalCutoff: {
    threshold: 9, comparator: '>=', flagLabel: 'positive-stress-screen',
    severity: 'advisory', citation: 'Cohen 1988 + Warttig 2013',
  },
};

describe('scoreLikertIndicator — BAT-12 (CRITICAL: 1-5 Likert 公式驗算)', () => {
  it('全答 1（最佳 capacity）→ score 100', () => {
    const ans = Object.fromEntries(BAT12.questions.map(q => [q.id, 1]));
    const r = scoreLikertIndicator(BAT12, ans);
    expect(r?.score).toBe(100);
  });

  it('全答 5（最差 capacity）→ score 0', () => {
    const ans = Object.fromEntries(BAT12.questions.map(q => [q.id, 5]));
    const r = scoreLikertIndicator(BAT12, ans);
    expect(r?.score).toBe(0);
  });

  it('全答 3（中位）→ score 50', () => {
    const ans = Object.fromEntries(BAT12.questions.map(q => [q.id, 3]));
    const r = scoreLikertIndicator(BAT12, ans);
    expect(r?.score).toBe(50);
  });

  it('subScale exhaustion 全 3 → subscale mean 3.0 觸發 cutoff', () => {
    const ans: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) ans[`psychological.burnout.q${i}`] = 3;
    const r = scoreLikertIndicator(BAT12, ans);
    const exh = r?.subScaleScores?.find(s => s.subScaleId === 'bat12.exhaustion');
    expect(exh?.subMean).toBe(3);
    expect(exh?.cutoffFlag).toBe(true);
    expect(exh?.cutoffSeverity).toBe('advisory');
  });
});

describe('scoreLikertIndicator — PSS-4 reverseScored', () => {
  it('q1=2, q2=3(reverse→1), q3=1(reverse→3), q4=2 → effective sum = 8', () => {
    const r = scoreLikertIndicator(PSS4, {
      'psychological.stress.q1': 2,
      'psychological.stress.q2': 3,
      'psychological.stress.q3': 1,
      'psychological.stress.q4': 2,
    });
    expect(r?.rawSum).toBe(8);  // 反向計分後
    expect(r?.cutoffFlag).toBe(false);  // 未到 9
  });

  it('q1=4, q2=0(reverse→4), q3=0(reverse→4), q4=4 → effective sum = 16 → cutoff', () => {
    const r = scoreLikertIndicator(PSS4, {
      'psychological.stress.q1': 4,
      'psychological.stress.q2': 0,
      'psychological.stress.q3': 0,
      'psychological.stress.q4': 4,
    });
    expect(r?.rawSum).toBe(16);
    expect(r?.cutoffFlag).toBe(true);
    expect(r?.cutoffSeverity).toBe('advisory');
  });
});

describe('scoreLikertIndicator — PHQ-2 cutoff', () => {
  it('全答 0 → no cutoff', () => {
    const r = scoreLikertIndicator(PHQ2, {
      'psychological.depression.q1': 0,
      'psychological.depression.q2': 0,
    });
    expect(r?.rawSum).toBe(0);
    expect(r?.cutoffFlag).toBe(false);
  });

  it('sum=3 → cutoff', () => {
    const r = scoreLikertIndicator(PHQ2, {
      'psychological.depression.q1': 2,
      'psychological.depression.q2': 1,
    });
    expect(r?.rawSum).toBe(3);
    expect(r?.cutoffFlag).toBe(true);
  });

  it('partial answer (only q1) → return null (minCompletionPolicy=1.0)', () => {
    const r = scoreLikertIndicator(PHQ2, { 'psychological.depression.q1': 3 });
    expect(r).toBeNull();
  });
});

describe('scoreLikertIndicator — direction', () => {
  it('higher_is_better: full max → capacity 100', () => {
    const ind: LikertIndicator = {
      kind: 'likert', id: 'vitality.sleep_quality', domain: 'vitality',
      label: 'sleep', style: 'capacity', direction: 'higher_is_better',
      weight: 1, license: 'public-domain', maxScore: 3,
      questions: [{ id: 'vitality.sleep_quality.q1', text: 'q', options: [] }],
    };
    const r = scoreLikertIndicator(ind, { 'vitality.sleep_quality.q1': 3 });
    expect(r?.score).toBe(100);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Expected: module not found / function missing。

- [ ] **Step 3: Implement scoreLikertIndicator**

```ts
// src/engine/func/scorer.ts (部分 — 後續 Task 1.4-1.6 補)
import type { Indicator, LikertIndicator, ObjectiveIndicator } from './questionnaire';
import { reverseScoreOf } from './utils';
import type { ICDomain } from '../../lib/education/schemas';
import type { AgeGroupAdult } from '../../lib/utils/age-groups';

export interface SubScaleScore {
  subScaleId: string;
  score: number | null;
  subMean?: number;
  cutoffFlag?: boolean;
  cutoffSeverity?: 'consult' | 'advisory';
}

export interface IndicatorScore {
  indicatorId: string;
  domain: ICDomain;
  style: 'capacity' | 'symptom';
  kind: 'likert' | 'objective';
  score: number;
  rawSum?: number;
  cutoffFlag?: boolean;
  cutoffSeverity?: 'consult' | 'advisory';
  subScaleScores?: SubScaleScore[];
  measuredValue?: number;
  zScore?: number;
  validTrialCount?: number;
  totalTrialCount?: number;
  questionsAnswered?: number;
  questionsTotal?: number;
}

export function scoreLikertIndicator(
  indicator: LikertIndicator,
  answers: Record<string, number>,
): IndicatorScore | null {
  const N = indicator.questions.length;
  const minScore = indicator.minScore ?? 0;
  const maxScore = indicator.maxScore;
  const range = maxScore - minScore;
  if (range <= 0) {
    throw new Error(`Invalid scale for ${indicator.id}: maxScore must > minScore`);
  }

  const validAnswerEntries = indicator.questions.map(q => ({
    qid: q.id,
    raw: answers[q.id],
    reverseScored: q.reverseScored ?? false,
  })).filter(e => Number.isFinite(e.raw));

  if (validAnswerEntries.length === 0) return null;

  const policy = indicator.minCompletionPolicy ?? (N <= 4 ? 1.0 : 0.5);
  const minRequired = Math.ceil(N * policy);
  if (validAnswerEntries.length < minRequired) return null;

  const effectiveAnswers = validAnswerEntries.map(e => ({
    qid: e.qid,
    effective: e.reverseScored ? reverseScoreOf(e.raw, maxScore, minScore) : e.raw,
  }));

  const rawSum = effectiveAnswers.reduce((s, e) => s + e.effective, 0);
  const adjustedSum = (rawSum / effectiveAnswers.length) * N;

  // CRITICAL formula for 1-based scale: (adjustedSum - N * minScore) / (N * range)
  const raw = (adjustedSum - N * minScore) / (N * range);
  const capacity = indicator.direction === 'higher_is_better' ? raw : 1 - raw;

  let cutoffFlag: boolean | undefined;
  let cutoffSeverity: 'consult' | 'advisory' | undefined;
  if (indicator.clinicalCutoff && validAnswerEntries.length === N) {
    const { threshold, comparator, severity } = indicator.clinicalCutoff;
    cutoffFlag = comparator === '>=' ? rawSum >= threshold : rawSum <= threshold;
    if (cutoffFlag) cutoffSeverity = severity;
  }

  let subScaleScores: SubScaleScore[] | undefined;
  if (indicator.subScales) {
    subScaleScores = indicator.subScales.map(sub => {
      const subAnswers = sub.questionIds
        .map(qid => effectiveAnswers.find(e => e.qid === qid))
        .filter((e): e is NonNullable<typeof e> => e !== undefined);
      if (subAnswers.length !== sub.questionIds.length) {
        return { subScaleId: sub.id, score: null };
      }
      const subSum = subAnswers.reduce((s, e) => s + e.effective, 0);
      const subMean = subSum / sub.questionIds.length;
      const subRaw = (subMean - minScore) / range;
      const subCapacity = indicator.direction === 'higher_is_better' ? subRaw : 1 - subRaw;

      let subCutoffFlag: boolean | undefined;
      let subCutoffSeverity: 'consult' | 'advisory' | undefined;
      if (sub.clinicalCutoff) {
        const { threshold, comparator, severity } = sub.clinicalCutoff;
        subCutoffFlag = comparator === '>=' ? subMean >= threshold : subMean <= threshold;
        if (subCutoffFlag) subCutoffSeverity = severity;
      }

      return {
        subScaleId: sub.id,
        score: Math.round(100 * subCapacity),
        subMean,
        cutoffFlag: subCutoffFlag,
        cutoffSeverity: subCutoffSeverity,
      };
    });
  }

  return {
    indicatorId: indicator.id,
    domain: indicator.domain,
    style: indicator.style,
    kind: 'likert',
    score: Math.round(100 * capacity),
    rawSum,
    cutoffFlag,
    cutoffSeverity,
    subScaleScores,
    questionsAnswered: validAnswerEntries.length,
    questionsTotal: N,
  };
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `pnpm vitest run tests/engine/func/scorer.test.ts`
Expected: all 10 tests pass，特別注意 BAT-12 三個 critical case（全 1=100、全 5=0、全 3=50）。

- [ ] **Step 5: Commit**

```bash
git add src/engine/func/scorer.ts tests/engine/func/scorer.test.ts
git commit -m "feat(func): scoreLikertIndicator with BAT-12 1-5 formula + reverseScored + cutoff"
```

---

### Task 1.4: scorer.ts — scoreObjectiveIndicator

**Files:**
- Modify: `src/engine/func/scorer.ts`（append）
- Test: `tests/engine/func/scorer.test.ts`（append）

- [ ] **Step 1: 撰寫測試（append 到 scorer.test.ts）**

```ts
// append 至 tests/engine/func/scorer.test.ts
import { scoreObjectiveIndicator } from '../../../src/engine/func/scorer';
import type { ObjectiveIndicator } from '../../../src/engine/func/questionnaire';

const RT: ObjectiveIndicator = {
  kind: 'objective', id: 'cognition.processing_speed', domain: 'cognition',
  label: 'RT', style: 'capacity', direction: 'higher_is_worse',
  weight: 1, license: 'research-open-noncommercial',
  test: {
    type: 'reaction-time', paradigm: 'simple-visual',
    trials: 20, warmupTrials: 5,
    validRangeMs: { min: 100, max: 2000 },
    norms: {
      '18-39': { mean: 350, std: 80, citation: 'NIH Toolbox' },
      '40-54': null,
      '55-64': null,
    },
  },
};

describe('scoreObjectiveIndicator — reaction-time', () => {
  it('measure = norm mean → percentile 0.5 → score 50', () => {
    // 5 warmup + 20 trials, median 350
    const trials = [...Array(5).fill(999), ...Array(20).fill(350)];
    const r = scoreObjectiveIndicator(RT, trials, '18-39');
    expect(r?.score).toBeGreaterThanOrEqual(49);
    expect(r?.score).toBeLessThanOrEqual(51);
  });

  it('measure << norm mean (fast)、direction=higher_is_worse → 高 capacity', () => {
    const trials = [...Array(5).fill(999), ...Array(20).fill(200)];  // very fast
    const r = scoreObjectiveIndicator(RT, trials, '18-39');
    expect(r!.score).toBeGreaterThan(90);
  });

  it('measure >> norm mean (slow) → 低 capacity', () => {
    const trials = [...Array(5).fill(999), ...Array(20).fill(700)];  // very slow
    const r = scoreObjectiveIndicator(RT, trials, '18-39');
    expect(r!.score).toBeLessThan(10);
  });

  it('離群試次 < 100ms 與 > 2000ms 被排除', () => {
    // 4 fast outliers + 16 valid @ 350 + 5 warmup
    const trials = [...Array(5).fill(999), 50, 80, 90, 50, ...Array(16).fill(350)];
    const r = scoreObjectiveIndicator(RT, trials, '18-39');
    expect(r?.validTrialCount).toBe(16);
  });

  it('age band 無 norm（null）in dev mode → return null', () => {
    const trials = [...Array(5).fill(999), ...Array(20).fill(350)];
    const r = scoreObjectiveIndicator(RT, trials, '40-54');
    expect(r).toBeNull();
  });

  it('z-clamp at ±4', () => {
    // mean=350 std=80, raw=3000 → z=33 → clamped to 4 (then -4 for higher_is_worse) → percentile ~0
    const trials = [...Array(5).fill(999), ...Array(20).fill(1999)];
    const r = scoreObjectiveIndicator(RT, trials, '18-39');
    expect(r!.zScore).toBeGreaterThanOrEqual(-4);
    expect(r!.zScore).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Expected: scoreObjectiveIndicator not exported。

- [ ] **Step 3: Append implementation 到 scorer.ts**

```ts
// append to src/engine/func/scorer.ts
import { zToPercentile, median, clamp } from './utils';

export function scoreObjectiveIndicator(
  indicator: ObjectiveIndicator,
  trials: number[],
  ageGroup: AgeGroupAdult,
): IndicatorScore | null {
  const { test } = indicator;

  const scoredTrials = trials.slice(test.warmupTrials ?? 0);
  if (scoredTrials.length === 0) return null;

  let validTrials = scoredTrials;
  if (test.type === 'reaction-time') {
    const { min, max } = test.validRangeMs;
    validTrials = scoredTrials.filter(v => v >= min && v <= max);
  }
  if (validTrials.length === 0) return null;

  const measuredValue = test.type === 'reaction-time'
    ? median(validTrials)
    : validTrials[0];

  const norm = test.norms[ageGroup];
  if (norm === null) {
    if (import.meta.env?.PROD) {
      throw new Error(`Norm for ${indicator.id}@${ageGroup} is null in prod build`);
    }
    return null;
  }
  const { mean: normMean, std: normStd } = norm;
  if (normStd <= 0 || normStd < Math.abs(normMean) * 0.01) return null;

  let z = (measuredValue - normMean) / normStd;
  if (indicator.direction === 'higher_is_worse') z = -z;
  z = clamp(z, -4, 4);

  const percentile = zToPercentile(z);

  return {
    indicatorId: indicator.id,
    domain: indicator.domain,
    style: indicator.style,
    kind: 'objective',
    score: Math.round(100 * percentile),
    measuredValue,
    zScore: z,
    validTrialCount: validTrials.length,
    totalTrialCount: trials.length,
  };
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `pnpm vitest run tests/engine/func/scorer.test.ts`
Expected: all RT tests pass。

- [ ] **Step 5: Commit**

```bash
git add src/engine/func/scorer.ts tests/engine/func/scorer.test.ts
git commit -m "feat(func): scoreObjectiveIndicator with z-clamp + norm null dev handling"
```

---

### Task 1.5: scorer.ts — scoreDomain + scoreAssessment

**Files:**
- Modify: `src/engine/func/scorer.ts`（append）
- Test: `tests/engine/func/scorer.test.ts`（append）

- [ ] **Step 1: 撰寫測試**

```ts
// append to tests/engine/func/scorer.test.ts
import { scoreDomain, scoreAssessment, type DomainScore } from '../../../src/engine/func/scorer';

describe('scoreDomain', () => {
  const mkScore = (id: string, score: number, style: 'capacity'|'symptom', weight: number = 1): IndicatorScore => ({
    indicatorId: id, domain: 'vitality', style, kind: 'likert', score,
  } as IndicatorScore);

  it('weighted avg', () => {
    const r = scoreDomain('vitality',
      [mkScore('vitality.a', 80, 'capacity'), mkScore('vitality.b', 40, 'symptom')],
      { 'vitality.a': 1, 'vitality.b': 1 },
    );
    expect(r?.score).toBe(60);  // (80+40)/2
  });

  it('band: 70+ → high, 40-69 → moderate, <40 → low', () => {
    const r1 = scoreDomain('vitality', [mkScore('vitality.a', 75, 'capacity')], { 'vitality.a': 1 });
    expect(r1?.band).toBe('high');
    const r2 = scoreDomain('vitality', [mkScore('vitality.a', 50, 'capacity')], { 'vitality.a': 1 });
    expect(r2?.band).toBe('moderate');
    const r3 = scoreDomain('vitality', [mkScore('vitality.a', 30, 'capacity')], { 'vitality.a': 1 });
    expect(r3?.band).toBe('low');
  });

  it('capacity / symptom view 拆分', () => {
    const r = scoreDomain('vitality',
      [mkScore('vitality.cap', 80, 'capacity'), mkScore('vitality.sym', 40, 'symptom')],
      { 'vitality.cap': 1, 'vitality.sym': 1 },
    );
    expect(r?.capacityScore).toBe(80);
    expect(r?.symptomScore).toBe(40);
  });

  it('totalWeight=0 throws', () => {
    expect(() => scoreDomain('vitality',
      [mkScore('vitality.a', 50, 'capacity')],
      { 'vitality.a': 0 },
    )).toThrow();
  });

  it('empty domain → null', () => {
    expect(scoreDomain('vitality', [], { 'vitality.a': 1 })).toBeNull();
  });
});

describe('scoreAssessment integration', () => {
  it('end-to-end with 2 indicators in 1 domain', () => {
    const PHQ2_min: LikertIndicator = {
      kind: 'likert', id: 'psychological.depression', domain: 'psychological',
      label: 'PHQ-2', style: 'symptom', direction: 'higher_is_worse',
      weight: 1, license: 'public-domain', maxScore: 3,
      questions: [
        { id: 'psychological.depression.q1', text: '', options: [] },
        { id: 'psychological.depression.q2', text: '', options: [] },
      ],
      minCompletionPolicy: 1.0,
    };
    const r = scoreAssessment({
      indicators: [PHQ2_min],
      answers: { 'psychological.depression.q1': 0, 'psychological.depression.q2': 0 },
      objectiveResults: {},
      ageGroup: '18-39',
    });
    expect(r.indicatorScores).toHaveLength(1);
    expect(r.domainScores).toHaveLength(1);
    expect(r.domainScores[0].score).toBe(100);  // PHQ-2 全 0 + higher_is_worse → capacity 100
    expect(r.applicableWeights['psychological.depression']).toBe(1);
  });
});
```

- [ ] **Step 2: Append implementation 到 scorer.ts**

```ts
// append to src/engine/func/scorer.ts
import type { Indicator } from './questionnaire';

export interface DomainScore {
  domain: ICDomain;
  score: number;
  band: 'high' | 'moderate' | 'low';
  capacityScore?: number;
  symptomScore?: number;
  contributingIndicators: number;
  missingIndicators: string[];
}

export function scoreDomain(
  domain: ICDomain,
  indicatorScores: IndicatorScore[],
  indicatorWeights: Record<string, number>,
): DomainScore | null {
  const inDomain = indicatorScores.filter(s => s.domain === domain);
  if (inDomain.length === 0) return null;

  const weighted = inDomain.map(s => ({
    score: s.score,
    weight: indicatorWeights[s.indicatorId] ?? 1.0,
    style: s.style,
  }));

  const totalWeight = weighted.reduce((s, x) => s + x.weight, 0);
  if (totalWeight === 0) {
    throw new Error(`scoreDomain: total weight for domain ${domain} is 0`);
  }

  const score = Math.round(
    weighted.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight
  );

  const computeView = (view: typeof weighted): number | undefined => {
    if (view.length === 0) return undefined;
    const w = view.reduce((s, x) => s + x.weight, 0);
    if (w === 0) return undefined;
    return Math.round(view.reduce((s, x) => s + x.score * x.weight, 0) / w);
  };

  const capView = weighted.filter(x => x.style === 'capacity');
  const symView = weighted.filter(x => x.style === 'symptom');

  return {
    domain,
    score,
    band: score >= 70 ? 'high' : score >= 40 ? 'moderate' : 'low',
    capacityScore: computeView(capView),
    symptomScore: computeView(symView),
    contributingIndicators: inDomain.length,
    missingIndicators: getMissingIndicatorIds(domain, indicatorScores, indicatorWeights),
  };
}

function getMissingIndicatorIds(
  domain: ICDomain,
  scoredIndicators: IndicatorScore[],
  applicableWeights: Record<string, number>,
): string[] {
  const scoredIds = new Set(scoredIndicators.map(s => s.indicatorId));
  return Object.keys(applicableWeights).filter(id =>
    id.startsWith(`${domain}.`) && !scoredIds.has(id)
  );
}

export function scoreAssessment(input: {
  indicators: Indicator[];
  answers: Record<string, number>;
  objectiveResults: Record<string, number[]>;
  ageGroup: AgeGroupAdult;
}): {
  indicatorScores: IndicatorScore[];
  domainScores: DomainScore[];
  applicableWeights: Record<string, number>;
} {
  const { indicators, answers, objectiveResults, ageGroup } = input;

  const applicable = indicators.filter(ind =>
    !ind.ageApplicability || ind.ageApplicability.includes(ageGroup)
  );

  const applicableWeights: Record<string, number> = {};
  for (const ind of applicable) applicableWeights[ind.id] = ind.weight;

  const indicatorScores: IndicatorScore[] = [];
  for (const ind of applicable) {
    if (ind.kind === 'likert') {
      const s = scoreLikertIndicator(ind, answers);
      if (s) indicatorScores.push(s);
    } else {
      const trials = objectiveResults[ind.id] ?? [];
      const s = scoreObjectiveIndicator(ind, trials, ageGroup);
      if (s) indicatorScores.push(s);
    }
  }

  const domains: ICDomain[] = ['vitality', 'locomotion', 'cognition', 'psychological', 'sensory'];
  const domainScores = domains
    .map(d => scoreDomain(d, indicatorScores, applicableWeights))
    .filter((d): d is DomainScore => d !== null);

  return { indicatorScores, domainScores, applicableWeights };
}
```

- [ ] **Step 3: Run to verify PASS**

Run: `pnpm vitest run tests/engine/func/scorer.test.ts`
Expected: all tests pass。

- [ ] **Step 4: Commit**

```bash
git add src/engine/func/scorer.ts tests/engine/func/scorer.test.ts
git commit -m "feat(func): scoreDomain + scoreAssessment with 5-IC-domain aggregation"
```

---

### Task 1.6: triage.ts — computeTriage（4 類分流 + confidence）

**Files:**
- Create: `src/engine/func/triage.ts`
- Test: `tests/engine/func/triage.test.ts`

- [ ] **Step 1: 撰寫測試**

```ts
// tests/engine/func/triage.test.ts
import { describe, it, expect } from 'vitest';
import { computeTriage, type TriageResult, type TriageCategory } from '../../../src/engine/func/triage';
import type { IndicatorScore, DomainScore } from '../../../src/engine/func/scorer';

const mkDomain = (domain: any, score: number, band: 'high'|'moderate'|'low'): DomainScore => ({
  domain, score, band, contributingIndicators: 1, missingIndicators: [],
});

const mkIndicator = (id: string, domain: any, opts: Partial<IndicatorScore> = {}): IndicatorScore => ({
  indicatorId: id, domain, style: 'symptom', kind: 'likert', score: 50, ...opts,
});

describe('computeTriage — 主規則', () => {
  it('all high, no cutoff → normal', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: [
        mkDomain('vitality', 80, 'high'),
        mkDomain('locomotion', 85, 'high'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 78, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('normal');
  });

  it('1 moderate, no cutoff → observe', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: [
        mkDomain('vitality', 50, 'moderate'),
        mkDomain('locomotion', 80, 'high'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 78, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('observe');
  });

  it('2 moderate → consult', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: [
        mkDomain('vitality', 50, 'moderate'),
        mkDomain('locomotion', 55, 'moderate'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 78, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('consult');
  });

  it('1 low → consult', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: [
        mkDomain('vitality', 30, 'low'),
        mkDomain('locomotion', 80, 'high'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 78, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('consult');
  });

  it('< 3 domains completed → incomplete', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: [
        mkDomain('vitality', 80, 'high'),
        mkDomain('locomotion', 80, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('incomplete');
  });

  it('advisory cutoff + all high → observe', () => {
    const r = computeTriage({
      indicatorScores: [
        mkIndicator('psychological.depression', 'psychological', {
          score: 75, cutoffFlag: true, cutoffSeverity: 'advisory',
        }),
      ],
      domainScores: [
        mkDomain('vitality', 80, 'high'),
        mkDomain('locomotion', 80, 'high'),
        mkDomain('cognition', 75, 'high'),
        mkDomain('psychological', 75, 'high'),
        mkDomain('sensory', 82, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('observe');
    expect(r.clinicalCutoffs.length).toBe(1);
  });

  it('consult cutoff overrides incomplete', () => {
    const r = computeTriage({
      indicatorScores: [
        mkIndicator('psychological.depression', 'psychological', {
          cutoffFlag: true, cutoffSeverity: 'consult',
        }),
      ],
      domainScores: [
        mkDomain('vitality', 80, 'high'),
      ],
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.category).toBe('consult');
  });
});

describe('computeTriage — confidence', () => {
  it('normal 5/5 → high confidence', () => {
    const r = computeTriage({
      indicatorScores: [],
      domainScores: ['vitality','locomotion','cognition','psychological','sensory'].map(d =>
        mkDomain(d, 80, 'high')
      ),
      applicableWeights: {},
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Expected: module not found。

- [ ] **Step 3: Implement triage.ts**

```ts
// src/engine/func/triage.ts
import type { IndicatorScore, DomainScore } from './scorer';
import type { ICDomain } from '../../lib/education/schemas';
import type { AgeGroupAdult } from '../../lib/utils/age-groups';

export type TriageCategory = 'normal' | 'observe' | 'consult' | 'incomplete';

export interface Recommendation {
  domain?: ICDomain;
  type: 'maintenance' | 'self-care' | 'in-depth-assessment' | 'consult-medical';
  message: string;
  suggestedSpecialties?: string[];
  triggerIndicators?: string[];
  evidenceFlags?: Array<'domain-low' | 'domain-moderate' | 'multi-domain-moderate' | 'clinical-cutoff'>;
}

export interface TriageResult {
  category: TriageCategory;
  confidence: number;
  summary: string;
  domainScores: DomainScore[];
  flaggedDomains: ICDomain[];
  clinicalCutoffs: Array<{
    indicatorId: string;
    subScaleId?: string;
    domain: ICDomain;
    flagLabel: string;
    severity: 'consult' | 'advisory';
  }>;
  recommendations: Recommendation[];
  incomplete: boolean;
  completedDomains: number;
  assessmentDate: string;
  ageGroup: AgeGroupAdult;
}

export function computeTriage(input: {
  indicatorScores: IndicatorScore[];
  domainScores: DomainScore[];
  applicableWeights: Record<string, number>;
  ageGroup: AgeGroupAdult;
  assessmentDate: string;
}): TriageResult {
  const { indicatorScores, domainScores, ageGroup, assessmentDate } = input;

  // Collect cutoffs (indicator-level + sub-scale-level)
  const clinicalCutoffs: TriageResult['clinicalCutoffs'] = [];
  for (const ind of indicatorScores) {
    if (ind.cutoffFlag && ind.cutoffSeverity) {
      clinicalCutoffs.push({
        indicatorId: ind.indicatorId,
        domain: ind.domain,
        flagLabel: `${ind.indicatorId}-cutoff`,
        severity: ind.cutoffSeverity,
      });
    }
    if (ind.subScaleScores) {
      for (const sub of ind.subScaleScores) {
        if (sub.cutoffFlag && sub.cutoffSeverity) {
          clinicalCutoffs.push({
            indicatorId: ind.indicatorId,
            subScaleId: sub.subScaleId,
            domain: ind.domain,
            flagLabel: `${sub.subScaleId}-cutoff`,
            severity: sub.cutoffSeverity,
          });
        }
      }
    }
  }

  const consultCutoff = clinicalCutoffs.some(c => c.severity === 'consult');
  const advisoryCutoff = clinicalCutoffs.some(c => c.severity === 'advisory');

  const completedDomains = domainScores.length;
  const allHigh = domainScores.every(d => d.band === 'high');
  const moderateCount = domainScores.filter(d => d.band === 'moderate').length;
  const lowCount = domainScores.filter(d => d.band === 'low').length;

  let category: TriageCategory;
  if (consultCutoff) {
    category = 'consult';
  } else if (completedDomains < 3) {
    category = 'incomplete';
  } else if (allHigh && !advisoryCutoff) {
    category = 'normal';
  } else if (lowCount >= 1 || moderateCount >= 2) {
    category = 'consult';
  } else if (moderateCount === 1 || (allHigh && advisoryCutoff)) {
    category = 'observe';
  } else {
    category = 'observe';
  }

  const flaggedDomains = domainScores.filter(d => d.band !== 'high').map(d => d.domain);
  const incomplete = category === 'incomplete';

  const confidence = computeConfidence(category, flaggedDomains.length, clinicalCutoffs.filter(c => c.severity === 'advisory').length, completedDomains);
  const summary = makeSummary(category, flaggedDomains, clinicalCutoffs);
  const recommendations = makeRecommendations(category, domainScores, indicatorScores, clinicalCutoffs);

  return {
    category, confidence, summary,
    domainScores, flaggedDomains, clinicalCutoffs, recommendations,
    incomplete, completedDomains, assessmentDate, ageGroup,
  };
}

function computeConfidence(
  category: TriageCategory, flagged: number, advisoryCutoff: number, completed: number,
): number {
  switch (category) {
    case 'incomplete': return Math.min(0.7, 0.3 + 0.1 * completed);
    case 'normal':     return Math.min(0.95, 0.7 + 0.05 * completed);
    case 'observe':    return Math.min(0.85, 0.6 + 0.05 * flagged + 0.05 * advisoryCutoff);
    case 'consult':    return Math.min(0.95, 0.7 + 0.05 * flagged + 0.05 * advisoryCutoff);
  }
}

function makeSummary(category: TriageCategory, flaggedDomains: ICDomain[], cutoffs: any[]): string {
  switch (category) {
    case 'normal': return '整體功能維持在良好範圍。';
    case 'observe': return '部分面向有待觀察，建議自我管理並追蹤。';
    case 'consult': return '功能評估結果建議找醫師討論。';
    case 'incomplete': return `已測 ${flaggedDomains.length}/5 個面向，建議完成評估再看整體結果。`;
  }
}

function makeRecommendations(
  category: TriageCategory,
  domainScores: DomainScore[],
  indicatorScores: IndicatorScore[],
  cutoffs: TriageResult['clinicalCutoffs'],
): Recommendation[] {
  const recs: Recommendation[] = [];
  // 此處 stub — 完整對照表於 Task 1.7 recommendations.ts 落實
  return recs;
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `pnpm vitest run tests/engine/func/triage.test.ts`
Expected: all tests pass。

- [ ] **Step 5: Commit**

```bash
git add src/engine/func/triage.ts tests/engine/func/triage.test.ts
git commit -m "feat(func): computeTriage with 4-category + confidence + cutoff handling"
```

---

### Task 1.7: recommendations.ts — Domain × 觸發 → 建議科別對照表

**Files:**
- Create: `src/engine/func/recommendations.ts`
- Test: `tests/engine/func/recommendations.test.ts`

- [ ] **Step 1: 撰寫測試**

```ts
// tests/engine/func/recommendations.test.ts
import { describe, it, expect } from 'vitest';
import { recommendationsFor } from '../../../src/engine/func/recommendations';

describe('recommendationsFor', () => {
  it('vitality low → 家醫科+營養師', () => {
    const r = recommendationsFor('consult', [
      { domain: 'vitality', score: 30, band: 'low', contributingIndicators: 1, missingIndicators: [] },
    ], [], []);
    const vit = r.find(x => x.domain === 'vitality');
    expect(vit?.type).toBe('consult-medical');
    expect(vit?.suggestedSpecialties).toContain('家庭醫學科');
  });

  it('cognition low → 神經內科+精神科', () => {
    const r = recommendationsFor('consult', [
      { domain: 'cognition', score: 35, band: 'low', contributingIndicators: 1, missingIndicators: [] },
    ], [], []);
    const cog = r.find(x => x.domain === 'cognition');
    expect(cog?.suggestedSpecialties).toContain('神經內科');
    expect(cog?.suggestedSpecialties).toContain('精神科');
  });

  it('PHQ-2 advisory cutoff → in-depth-assessment 提示 PHQ-9', () => {
    const r = recommendationsFor('observe', [], [], [
      { indicatorId: 'psychological.depression', domain: 'psychological',
        flagLabel: 'positive-depression-screen', severity: 'advisory' },
    ]);
    const phq = r.find(x => x.triggerIndicators?.includes('psychological.depression'));
    expect(phq?.type).toBe('in-depth-assessment');
  });
});
```

- [ ] **Step 2: Implement recommendations.ts**

```ts
// src/engine/func/recommendations.ts
import type { ICDomain } from '../../lib/education/schemas';
import type { DomainScore, IndicatorScore } from './scorer';
import type { Recommendation, TriageCategory, TriageResult } from './triage';

export function recommendationsFor(
  category: TriageCategory,
  domainScores: DomainScore[],
  indicatorScores: IndicatorScore[],
  cutoffs: TriageResult['clinicalCutoffs'],
): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const ds of domainScores) {
    if (ds.band === 'high') continue;
    const r = perDomainRec(ds.domain, ds.band);
    if (r) recs.push(r);
  }

  for (const c of cutoffs) {
    if (c.severity === 'advisory') {
      const r = advisoryCutoffRec(c.indicatorId);
      if (r) recs.push(r);
    }
  }

  for (const ind of indicatorScores.filter(i => i.domain === 'sensory')) {
    const r = sensoryIndicatorRec(ind.indicatorId);
    if (r) recs.push(r);
  }

  return recs;
}

function perDomainRec(domain: ICDomain, band: 'moderate' | 'low'): Recommendation | null {
  const table: Record<ICDomain, { mod: Recommendation; low: Recommendation }> = {
    vitality: {
      mod: { domain: 'vitality', type: 'self-care', message: '建議調整睡眠、營養與作息。' },
      low: { domain: 'vitality', type: 'consult-medical', message: '建議找家庭醫學科或營養師討論。',
             suggestedSpecialties: ['家庭醫學科', '營養師'] },
    },
    locomotion: {
      mod: { domain: 'locomotion', type: 'self-care', message: '建議增加每週身體活動量。' },
      low: { domain: 'locomotion', type: 'consult-medical', message: '建議找復健科或家醫科評估。',
             suggestedSpecialties: ['復健科', '家庭醫學科'] },
    },
    cognition: {
      mod: { domain: 'cognition', type: 'in-depth-assessment', message: '建議進一步認知功能評估。' },
      low: { domain: 'cognition', type: 'consult-medical', message: '建議找神經內科或精神科評估。',
             suggestedSpecialties: ['神經內科', '精神科'] },
    },
    psychological: {
      mod: { domain: 'psychological', type: 'self-care', message: '建議壓力管理與情緒照顧。' },
      low: { domain: 'psychological', type: 'consult-medical', message: '建議找身心科或心理諮商。',
             suggestedSpecialties: ['身心科', '精神科', '心理諮商'] },
    },
    sensory: {
      mod: { domain: 'sensory', type: 'self-care', message: '建議減少螢幕使用、定期視聽檢查。' },
      low: { domain: 'sensory', type: 'consult-medical', message: '建議找眼科或耳鼻喉科評估。',
             suggestedSpecialties: ['眼科', '耳鼻喉科'] },
    },
  };
  return band === 'low' ? table[domain].low : table[domain].mod;
}

function advisoryCutoffRec(indicatorId: string): Recommendation | null {
  if (indicatorId === 'psychological.depression') {
    return { domain: 'psychological', type: 'in-depth-assessment',
             message: 'PHQ-2 篩檢偏高，建議完成 PHQ-9 進一步評估（S2）。',
             triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'psychological.anxiety') {
    return { domain: 'psychological', type: 'in-depth-assessment',
             message: 'GAD-2 篩檢偏高，建議完成 GAD-7 進一步評估（S2）。',
             triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'psychological.stress') {
    return { domain: 'psychological', type: 'in-depth-assessment',
             message: 'PSS-4 顯示高壓力，建議完成 PSS-10 進一步評估（S2）。',
             triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'psychological.wellbeing') {
    return { domain: 'psychological', type: 'consult-medical',
             message: 'WHO-5 wellbeing 偏低，建議找身心科討論。',
             suggestedSpecialties: ['身心科', '精神科'],
             triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'psychological.burnout') {
    return { domain: 'psychological', type: 'self-care',
             message: 'BAT-12 burnout 偏高，建議工作壓力管理。',
             triggerIndicators: [indicatorId] };
  }
  return null;
}

function sensoryIndicatorRec(indicatorId: string): Recommendation | null {
  if (indicatorId === 'sensory.vision_impact') {
    return { domain: 'sensory', type: 'consult-medical', message: '建議找眼科檢查。',
             suggestedSpecialties: ['眼科'], triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'sensory.hearing_impact') {
    return { domain: 'sensory', type: 'consult-medical', message: '建議找耳鼻喉科檢查。',
             suggestedSpecialties: ['耳鼻喉科'], triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'sensory.screen_fatigue') {
    return { domain: 'sensory', type: 'self-care', message: '建議減少螢幕使用、20-20-20 護眼法。' };
  }
  return null;
}
```

- [ ] **Step 3: Wire recommendationsFor 進 triage.ts**

修改 `src/engine/func/triage.ts` 中的 `makeRecommendations`：

```ts
import { recommendationsFor } from './recommendations';

function makeRecommendations(
  category: TriageCategory,
  domainScores: DomainScore[],
  indicatorScores: IndicatorScore[],
  cutoffs: TriageResult['clinicalCutoffs'],
): Recommendation[] {
  return recommendationsFor(category, domainScores, indicatorScores, cutoffs);
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `pnpm vitest run tests/engine/func/recommendations.test.ts tests/engine/func/triage.test.ts`
Expected: all pass。

- [ ] **Step 5: Commit**

```bash
git add src/engine/func/recommendations.ts tests/engine/func/recommendations.test.ts src/engine/func/triage.ts
git commit -m "feat(func): recommendations 對照表 + wire into triage"
```

---

### Task 1.8: radar-scoring.ts — buildRadarData

**Files:**
- Create: `src/engine/func/radar-scoring.ts`
- Test: `tests/engine/func/radar-scoring.test.ts`

- [ ] **Step 1: 撰寫測試**

```ts
// tests/engine/func/radar-scoring.test.ts
import { describe, it, expect } from 'vitest';
import { buildRadarData } from '../../../src/engine/func/radar-scoring';
import type { TriageResult } from '../../../src/engine/func/triage';

const mkTriage = (partial: Partial<TriageResult>): TriageResult => ({
  category: 'normal', confidence: 0.9, summary: '',
  domainScores: [], flaggedDomains: [], clinicalCutoffs: [],
  recommendations: [], incomplete: false, completedDomains: 5,
  assessmentDate: '2026-05-28', ageGroup: '18-39',
  ...partial,
});

describe('buildRadarData', () => {
  it('5 軸固定順序', () => {
    const r = buildRadarData(mkTriage({
      domainScores: [
        { domain: 'sensory', score: 80, band: 'high', contributingIndicators: 1, missingIndicators: [] },
        { domain: 'vitality', score: 70, band: 'high', contributingIndicators: 1, missingIndicators: [] },
      ],
    }), []);
    expect(r.axes.map(a => a.domain)).toEqual(['vitality', 'locomotion', 'cognition', 'psychological', 'sensory']);
  });

  it('未測 domain → score: null + band: null', () => {
    const r = buildRadarData(mkTriage({
      domainScores: [
        { domain: 'vitality', score: 70, band: 'high', contributingIndicators: 1, missingIndicators: [] },
      ],
    }), []);
    const loco = r.axes.find(a => a.domain === 'locomotion');
    expect(loco?.score).toBeNull();
    expect(loco?.band).toBeNull();
  });

  it('bandThresholds 固定 40/70', () => {
    const r = buildRadarData(mkTriage({}), []);
    expect(r.bandThresholds).toEqual({ moderate: 40, high: 70 });
  });
});
```

- [ ] **Step 2: Implement radar-scoring.ts**

```ts
// src/engine/func/radar-scoring.ts
import type { IndicatorScore, DomainScore, SubScaleScore } from './scorer';
import type { TriageResult } from './triage';
import type { ICDomain } from '../../lib/education/schemas';

const DOMAIN_ORDER: ICDomain[] = ['vitality', 'locomotion', 'cognition', 'psychological', 'sensory'];

const DOMAIN_LABELS: Record<ICDomain, string> = {
  vitality: '身體活力',
  locomotion: '行動功能',
  cognition: '認知功能',
  psychological: '心理功能',
  sensory: '感官功能',
};

export interface RadarAxis {
  domain: ICDomain;
  label: string;
  score: number | null;
  band: 'high' | 'moderate' | 'low' | null;
  capacityScore?: number;
  symptomScore?: number;
  indicators: Array<{
    id: string;
    label: string;
    score: number;
    cutoffFlag?: boolean;
    cutoffSeverity?: 'consult' | 'advisory';
    subScaleScores?: SubScaleScore[];
  }>;
}

export interface RadarData {
  axes: RadarAxis[];
  bandThresholds: { moderate: 40; high: 70 };
  meta: {
    triageCategory: TriageResult['category'];
    incomplete: boolean;
    completedDomains: number;
    totalDomains: 5;
    assessmentDate: string;
    ageGroup: TriageResult['ageGroup'];
  };
}

export function buildRadarData(
  triage: TriageResult,
  indicatorScores: IndicatorScore[],
  indicatorLabels: Record<string, string> = {},
): RadarData {
  const domainMap = new Map(triage.domainScores.map(d => [d.domain, d]));

  const axes: RadarAxis[] = DOMAIN_ORDER.map(domain => {
    const d = domainMap.get(domain);
    const indicators = indicatorScores
      .filter(s => s.domain === domain)
      .map(s => ({
        id: s.indicatorId,
        label: indicatorLabels[s.indicatorId] ?? s.indicatorId,
        score: s.score,
        cutoffFlag: s.cutoffFlag,
        cutoffSeverity: s.cutoffSeverity,
        subScaleScores: s.subScaleScores,
      }));

    if (!d) {
      return {
        domain, label: DOMAIN_LABELS[domain],
        score: null, band: null,
        indicators,
      };
    }
    return {
      domain, label: DOMAIN_LABELS[domain],
      score: d.score, band: d.band,
      capacityScore: d.capacityScore,
      symptomScore: d.symptomScore,
      indicators,
    };
  });

  return {
    axes,
    bandThresholds: { moderate: 40, high: 70 },
    meta: {
      triageCategory: triage.category,
      incomplete: triage.incomplete,
      completedDomains: triage.completedDomains,
      totalDomains: 5,
      assessmentDate: triage.assessmentDate,
      ageGroup: triage.ageGroup,
    },
  };
}
```

- [ ] **Step 3: Run to verify PASS**

Run: `pnpm vitest run tests/engine/func/radar-scoring.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/engine/func/radar-scoring.ts tests/engine/func/radar-scoring.test.ts
git commit -m "feat(func): buildRadarData with 5-axis fixed order + untested domain handling"
```

---

### Task 1.9: objective-tests.ts — 反應時間 + TMT-A 量測（runtime API）

**Files:**
- Create: `src/engine/func/objective-tests.ts`（由 `behavior-analysis.ts` git mv 後重寫；本 task 在 Phase 2 完成 git mv 後執行——若想 TDD 先寫測試，本 task 可暫先在 func/ 直接 create new file，Phase 2 再 git mv 既有 behavior-analysis.ts 過來作為 history anchor）

- [ ] **Step 1: 撰寫測試**

```ts
// tests/engine/func/objective-tests.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createReactionTimeRunner, createTmtARunner } from '../../../src/engine/func/objective-tests';

describe('createReactionTimeRunner', () => {
  it('records trials and returns array', () => {
    const r = createReactionTimeRunner({ trials: 5, warmupTrials: 2 });
    r.recordTrial(450);
    r.recordTrial(380);
    r.recordTrial(420);
    r.recordTrial(390);
    r.recordTrial(410);
    expect(r.getTrials()).toEqual([450, 380, 420, 390, 410]);
    expect(r.isComplete()).toBe(true);
  });

  it('isComplete only after all trials', () => {
    const r = createReactionTimeRunner({ trials: 3, warmupTrials: 1 });
    r.recordTrial(400);
    r.recordTrial(400);
    expect(r.isComplete()).toBe(false);
    r.recordTrial(400);
    expect(r.isComplete()).toBe(true);
  });
});

describe('createTmtARunner', () => {
  it('records total time on completion', () => {
    const r = createTmtARunner();
    const t0 = 1000;
    const t1 = 38500;
    r.start(t0);
    r.finish(t1);
    expect(r.getElapsedSec()).toBe(37.5);
  });
});
```

- [ ] **Step 2: Implement objective-tests.ts**

```ts
// src/engine/func/objective-tests.ts

export interface ReactionTimeRunnerOpts {
  trials: number;
  warmupTrials: number;
}

export function createReactionTimeRunner(opts: ReactionTimeRunnerOpts) {
  const records: number[] = [];
  return {
    recordTrial(ms: number) {
      records.push(ms);
    },
    getTrials(): number[] {
      return [...records];
    },
    isComplete(): boolean {
      return records.length >= opts.trials;
    },
    reset() {
      records.length = 0;
    },
  };
}

export function createTmtARunner() {
  let startMs: number | null = null;
  let endMs: number | null = null;
  return {
    start(now: number = Date.now()) {
      startMs = now;
      endMs = null;
    },
    finish(now: number = Date.now()) {
      if (startMs === null) throw new Error('TmtA not started');
      endMs = now;
    },
    getElapsedSec(): number {
      if (startMs === null || endMs === null) throw new Error('TmtA incomplete');
      return (endMs - startMs) / 1000;
    },
    reset() {
      startMs = null;
      endMs = null;
    },
  };
}
```

- [ ] **Step 3: Run to verify PASS**

Run: `pnpm vitest run tests/engine/func/objective-tests.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/engine/func/objective-tests.ts tests/engine/func/objective-tests.test.ts
git commit -m "feat(func): objective-tests runners (reaction-time + TMT-A timing)"
```

---

### Task 1.10: indicators.yaml — Layer 2 indicator 資料檔（spec §2.4 全部）

**Files:**
- Create: `src/data/questionnaire/indicators.yaml`

- [ ] **Step 1: Create indicators.yaml**

```yaml
# src/data/questionnaire/indicators.yaml
# Layer 2 indicators per S1 spec §2.4

vitality:
  - id: vitality.sleep_quality
    kind: likert
    domain: vitality
    label: 睡眠品質
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: vitality.sleep_quality.q1, text: "過去 1 週，您整體睡得好嗎？", options: [{label: "非常差", score: 0}, {label: "差", score: 1}, {label: "好", score: 2}, {label: "非常好", score: 3}] }
  - id: vitality.appetite
    kind: likert
    domain: vitality
    label: 食慾狀態
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: vitality.appetite.q1, text: "過去 1 週，您的食慾如何？", options: [{label: "非常差", score: 0}, {label: "差", score: 1}, {label: "好", score: 2}, {label: "非常好", score: 3}] }
  - id: vitality.weight_stability
    kind: likert
    domain: vitality
    label: 體重穩定度
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: vitality.weight_stability.q1, text: "過去 3 個月，您的體重變化？", options: [{label: "顯著變化", score: 0}, {label: "中度變化", score: 1}, {label: "輕微變化", score: 2}, {label: "穩定", score: 3}] }
  - id: vitality.fatigue
    kind: likert
    domain: vitality
    label: 疲勞程度
    style: symptom
    direction: higher_is_worse
    maxScore: 4
    weight: 1.0
    license: cc-by-nc-sa
    loincCode: "76342-5"
    minCompletionPolicy: 1.0
    questions:
      - { id: vitality.fatigue.q1, text: "過去 7 天，我感到疲勞", options: [{label: "從不", score: 0}, {label: "很少", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "總是", score: 4}] }
      - { id: vitality.fatigue.q2, text: "過去 7 天，疲勞讓我無法做想做的事", options: [{label: "從不", score: 0}, {label: "很少", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "總是", score: 4}] }
      - { id: vitality.fatigue.q3, text: "過去 7 天，我感到體力被耗盡", options: [{label: "從不", score: 0}, {label: "很少", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "總是", score: 4}] }
      - { id: vitality.fatigue.q4, text: "過去 7 天，疲勞影響我做事的效率", options: [{label: "從不", score: 0}, {label: "很少", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "總是", score: 4}] }

locomotion:
  - id: locomotion.activity_level
    kind: likert
    domain: locomotion
    label: 身體活動量
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: locomotion.activity_level.q1, text: "過去 1 週，您有多少天進行至少 30 分鐘的中等強度運動？", options: [{label: "0 天", score: 0}, {label: "1-2 天", score: 1}, {label: "3-4 天", score: 2}, {label: "5+ 天", score: 3}] }
  - id: locomotion.sedentary_time
    kind: likert
    domain: locomotion
    label: 久坐時間
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: locomotion.sedentary_time.q1, text: "工作日，您每天坐著的時間？", options: [{label: "< 4 小時", score: 0}, {label: "4-6 小時", score: 1}, {label: "6-8 小時", score: 2}, {label: "> 8 小時", score: 3}] }
  - id: locomotion.walking_ability
    kind: likert
    domain: locomotion
    label: 步行能力
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: locomotion.walking_ability.q1, text: "您能否連續步行 30 分鐘不感到困難？", options: [{label: "完全不能", score: 0}, {label: "勉強可以", score: 1}, {label: "輕鬆可以", score: 2}, {label: "非常輕鬆", score: 3}] }

cognition:
  - id: cognition.attention_self_report
    kind: likert
    domain: cognition
    label: 注意力自評
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: cognition.attention_self_report.q1, text: "您能維持專注工作 30 分鐘不分心嗎？", options: [{label: "完全不能", score: 0}, {label: "勉強可以", score: 1}, {label: "輕鬆可以", score: 2}, {label: "非常輕鬆", score: 3}] }
  - id: cognition.memory_self_report
    kind: likert
    domain: cognition
    label: 記憶自評
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: cognition.memory_self_report.q1, text: "您最近的記憶力如何？", options: [{label: "很差", score: 0}, {label: "差", score: 1}, {label: "好", score: 2}, {label: "很好", score: 3}] }
  - id: cognition.processing_speed
    kind: objective
    domain: cognition
    label: 處理速度（反應時間）
    style: capacity
    direction: higher_is_worse
    weight: 1.0
    license: research-open-noncommercial
    test:
      type: reaction-time
      paradigm: simple-visual
      trials: 20
      warmupTrials: 5
      validRangeMs: { min: 100, max: 2000 }
      norms:
        "18-39": null  # TODO: NIH Toolbox simple RT
        "40-54": null
        "55-64": null
  - id: cognition.executive_function
    kind: objective
    domain: cognition
    label: 執行功能（TMT-A）
    style: capacity
    direction: higher_is_worse
    weight: 1.0
    license: research-open-noncommercial
    test:
      type: tmt-a
      targetCount: 25
      administration: browser-mouse
      norms:
        "18-39": null  # TODO: Tombaugh 2004
        "40-54": null
        "55-64": null

psychological:
  - id: psychological.wellbeing
    kind: likert
    domain: psychological
    label: 心理福祉 (WHO-5)
    style: capacity
    direction: higher_is_better
    maxScore: 5
    weight: 1.0
    license: cc-by-nc-sa
    minCompletionPolicy: 1.0
    questions:
      - { id: psychological.wellbeing.q1, text: "過去 2 週，我感到開心並心情好", options: [{label: "從不", score: 0}, {label: "偶爾", score: 1}, {label: "不到一半時間", score: 2}, {label: "一半以上時間", score: 3}, {label: "大部分時間", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.wellbeing.q2, text: "過去 2 週，我感到平靜且放鬆", options: [{label: "從不", score: 0}, {label: "偶爾", score: 1}, {label: "不到一半時間", score: 2}, {label: "一半以上時間", score: 3}, {label: "大部分時間", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.wellbeing.q3, text: "過去 2 週，我感到精力充沛", options: [{label: "從不", score: 0}, {label: "偶爾", score: 1}, {label: "不到一半時間", score: 2}, {label: "一半以上時間", score: 3}, {label: "大部分時間", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.wellbeing.q4, text: "過去 2 週，起床時感到精神飽滿", options: [{label: "從不", score: 0}, {label: "偶爾", score: 1}, {label: "不到一半時間", score: 2}, {label: "一半以上時間", score: 3}, {label: "大部分時間", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.wellbeing.q5, text: "過去 2 週，我的日常生活充滿有趣的事", options: [{label: "從不", score: 0}, {label: "偶爾", score: 1}, {label: "不到一半時間", score: 2}, {label: "一半以上時間", score: 3}, {label: "大部分時間", score: 4}, {label: "總是", score: 5}] }
    clinicalCutoff:
      threshold: 13
      comparator: "<="
      flagLabel: low-wellbeing-screen
      severity: advisory
      citation: "Topp 2015 (raw ≤13 ≈ %≤52)"
  - id: psychological.burnout
    kind: likert
    domain: psychological
    label: 職業倦怠 (BAT-12)
    style: symptom
    direction: higher_is_worse
    maxScore: 5
    minScore: 1
    weight: 1.0
    license: cc-by-nc-sa
    minCompletionPolicy: 1.0
    questions:
      - { id: psychological.burnout.q1, text: "工作上，我感到精疲力竭", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q2, text: "經過一天工作，我難以恢復精力", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q3, text: "工作中，我感到身體疲憊", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q4, text: "我難以對工作投入熱情", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q5, text: "工作中我感到強烈的厭惡", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q6, text: "我對工作態度漠然", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q7, text: "工作時難以集中注意力", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q8, text: "工作時思緒紊亂", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q9, text: "工作時健忘且容易分心", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q10, text: "工作時無法控制情緒", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q11, text: "工作時容易煩躁", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
      - { id: psychological.burnout.q12, text: "工作時容易過度反應", options: [{label: "從不", score: 1}, {label: "很少", score: 2}, {label: "有時", score: 3}, {label: "經常", score: 4}, {label: "總是", score: 5}] }
    subScales:
      - id: bat12.exhaustion
        label: 精疲力竭
        questionIds: [psychological.burnout.q1, psychological.burnout.q2, psychological.burnout.q3]
        clinicalCutoff:
          threshold: 2.96
          comparator: ">="
          flagLabel: bat12-exhaustion-redzone
          severity: advisory
          citation: "Schaufeli 2020 BAT manual"
      - id: bat12.mental_distance
        label: 心理疏離
        questionIds: [psychological.burnout.q4, psychological.burnout.q5, psychological.burnout.q6]
        clinicalCutoff:
          threshold: 2.81
          comparator: ">="
          flagLabel: bat12-mental-distance-redzone
          severity: advisory
          citation: "Schaufeli 2020"
      - id: bat12.cognitive_impairment
        label: 認知失能
        questionIds: [psychological.burnout.q7, psychological.burnout.q8, psychological.burnout.q9]
        clinicalCutoff:
          threshold: 2.41
          comparator: ">="
          flagLabel: bat12-cognitive-impairment-redzone
          severity: advisory
          citation: "Schaufeli 2020"
      - id: bat12.emotional_impairment
        label: 情緒失調
        questionIds: [psychological.burnout.q10, psychological.burnout.q11, psychological.burnout.q12]
        clinicalCutoff:
          threshold: 2.61
          comparator: ">="
          flagLabel: bat12-emotional-impairment-redzone
          severity: advisory
          citation: "Schaufeli 2020"
  - id: psychological.depression
    kind: likert
    domain: psychological
    label: 憂鬱篩檢 (PHQ-2)
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    loincCode: "55757-9"
    minCompletionPolicy: 1.0
    questions:
      - { id: psychological.depression.q1, text: "過去 2 週，您對任何事都提不起興趣", loincCode: "44250-9", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.depression.q2, text: "過去 2 週，您感到沮喪、憂鬱或無望", loincCode: "44255-8", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
    clinicalCutoff:
      threshold: 3
      comparator: ">="
      flagLabel: positive-depression-screen
      severity: advisory
      citation: "Kroenke 2003 (sens 83% / spec 92%)"
  - id: psychological.anxiety
    kind: likert
    domain: psychological
    label: 焦慮篩檢 (GAD-2)
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    minCompletionPolicy: 1.0
    questions:
      - { id: psychological.anxiety.q1, text: "過去 2 週，您感到緊張、焦慮或坐立不安", loincCode: "69725-0", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.anxiety.q2, text: "過去 2 週，您無法停止或控制擔憂", loincCode: "68509-9", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
    clinicalCutoff:
      threshold: 3
      comparator: ">="
      flagLabel: positive-anxiety-screen
      severity: advisory
      citation: "Kroenke 2007 (sens 86% / spec 83%)"
  - id: psychological.stress
    kind: likert
    domain: psychological
    label: 壓力篩檢 (PSS-4)
    style: symptom
    direction: higher_is_worse
    maxScore: 4
    weight: 1.0
    license: research-open-noncommercial
    minCompletionPolicy: 1.0
    questions:
      - { id: psychological.stress.q1, text: "過去 1 個月，您多常感到無法掌控生活中的重要事情？", options: [{label: "從不", score: 0}, {label: "幾乎沒有", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "非常常", score: 4}] }
      - { id: psychological.stress.q2, text: "過去 1 個月，您多常感到能掌握自己的時間？", reverseScored: true, options: [{label: "從不", score: 0}, {label: "幾乎沒有", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "非常常", score: 4}] }
      - { id: psychological.stress.q3, text: "過去 1 個月，您多常感到事情如您所願？", reverseScored: true, options: [{label: "從不", score: 0}, {label: "幾乎沒有", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "非常常", score: 4}] }
      - { id: psychological.stress.q4, text: "過去 1 個月，您多常感到困難堆積到無法克服？", options: [{label: "從不", score: 0}, {label: "幾乎沒有", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "非常常", score: 4}] }
    clinicalCutoff:
      threshold: 9
      comparator: ">="
      flagLabel: positive-stress-screen
      severity: advisory
      citation: "Cohen 1988 (PSS-4 short form) + Warttig 2013 UK norms"

sensory:
  - id: sensory.functional_acuity
    kind: likert
    domain: sensory
    label: 感官功能自評
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: study-developed
    questions:
      - { id: sensory.functional_acuity.q1, text: "過去 1 週，您能清楚看清遠處與聽見對話嗎？", options: [{label: "完全不能", score: 0}, {label: "勉強可以", score: 1}, {label: "輕鬆可以", score: 2}, {label: "非常清楚", score: 3}] }
  - id: sensory.vision_impact
    kind: likert
    domain: sensory
    label: 視覺影響生活
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: sensory.vision_impact.q1, text: "過去 1 個月，視覺問題影響您日常生活的程度？", options: [{label: "無", score: 0}, {label: "輕微", score: 1}, {label: "中度", score: 2}, {label: "嚴重", score: 3}] }
  - id: sensory.hearing_impact
    kind: likert
    domain: sensory
    label: 聽覺影響生活
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: sensory.hearing_impact.q1, text: "過去 1 個月，聽覺問題影響您日常生活的程度？", options: [{label: "無", score: 0}, {label: "輕微", score: 1}, {label: "中度", score: 2}, {label: "嚴重", score: 3}] }
  - id: sensory.screen_fatigue
    kind: likert
    domain: sensory
    label: 螢幕疲勞
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: sensory.screen_fatigue.q1, text: "過去 1 週，使用螢幕後您多常感到眼睛疲勞？", options: [{label: "從不", score: 0}, {label: "偶爾", score: 1}, {label: "經常", score: 2}, {label: "總是", score: 3}] }
```

- [ ] **Step 2: Commit**

```bash
git add src/data/questionnaire/indicators.yaml
git commit -m "feat(data): add indicators.yaml with all 5 IC domains × ~17 indicators"
```

---

### Task 1.11: validate-indicators.ts — Prebuild 守門

**Files:**
- Create: `scripts/validate-indicators.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement validator**

```ts
// scripts/validate-indicators.ts
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import {
  indicatorSchema, INDICATOR_KINDS, LICENSE_KINDS, INDICATOR_STYLES, DIRECTION_KINDS,
  type Indicator,
} from '../src/engine/func/questionnaire';
import { IC_DOMAIN_NAMES, type ICDomain } from '../src/lib/education/schemas';

const fail = (msg: string) => {
  console.error(`[validate-indicators] FAIL: ${msg}`);
  process.exit(1);
};
const warn = (msg: string) => console.warn(`[validate-indicators] WARN: ${msg}`);

const yamlPath = path.join(process.cwd(), 'src/data/questionnaire/indicators.yaml');
const raw = yaml.load(fs.readFileSync(yamlPath, 'utf8')) as Record<string, unknown[]>;

const allIndicators: Indicator[] = [];
const isProd = process.env.NODE_ENV === 'production';

for (const [domain, list] of Object.entries(raw)) {
  if (!IC_DOMAIN_NAMES.includes(domain as ICDomain)) {
    fail(`unknown domain: ${domain}`);
  }
  for (const ind of list as unknown[]) {
    const parsed = indicatorSchema.safeParse(ind);
    if (!parsed.success) {
      fail(`indicator parse error in ${domain}: ${JSON.stringify(parsed.error.issues, null, 2)}`);
    }
    const data = parsed.data;
    if (data.license === 'commercial') fail(`commercial license forbidden: ${data.id}`);
    if (!data.id.startsWith(`${domain}.`)) {
      fail(`indicator id ${data.id} prefix mismatch with domain ${domain}`);
    }
    if (data.kind === 'likert' && data.subScales) {
      const qids = new Set(data.questions.map(q => q.id));
      for (const sub of data.subScales) {
        for (const qid of sub.questionIds) {
          if (!qids.has(qid)) fail(`subScale ${sub.id} references unknown question id ${qid}`);
        }
      }
    }
    if (data.kind === 'objective') {
      for (const [ag, norm] of Object.entries(data.test.norms)) {
        if (norm === null) {
          if (isProd) fail(`norm null in prod for ${data.id}@${ag}`);
          else warn(`norm null for ${data.id}@${ag} (dev allowed; prod will fail)`);
        } else {
          if (norm.std <= 0 || norm.std < Math.abs(norm.mean) * 0.01) {
            fail(`norm std too small for ${data.id}@${ag}`);
          }
        }
      }
    }
    if (data.kind === 'likert') {
      const minS = data.minScore ?? 0;
      for (const q of data.questions) {
        for (const opt of q.options) {
          if (opt.score < minS || opt.score > data.maxScore) {
            fail(`option score out of [${minS}, ${data.maxScore}] for ${q.id}`);
          }
        }
      }
    }
    allIndicators.push(data);
  }
}

// charter §0.3 enforcement: each domain must have ≥1 capacity indicator
for (const domain of IC_DOMAIN_NAMES) {
  const inDomain = allIndicators.filter(i => i.domain === domain);
  if (inDomain.length === 0) fail(`domain ${domain} has 0 indicators`);
  const capCount = inDomain.filter(i => i.style === 'capacity').length;
  if (capCount === 0) fail(`domain ${domain} has 0 capacity-style indicators (charter §0.3)`);
}

console.log(`[validate-indicators] OK: ${allIndicators.length} indicators across ${IC_DOMAIN_NAMES.length} domains`);
```

- [ ] **Step 2: 加入 prebuild chain in package.json**

修改 `package.json` 中 `"prebuild"` script，**append** `tsx scripts/validate-indicators.ts`：

```json
"prebuild": "tsx scripts/build-content-index.ts && tsx scripts/validate-indicators.ts && tsx scripts/build-questionnaire-applicability.ts"
```

- [ ] **Step 3: Run validator manually**

Run: `tsx scripts/validate-indicators.ts`
Expected: `[validate-indicators] OK: ~17 indicators across 5 domains` 或顯示具體 fail 並 exit 1。

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-indicators.ts package.json
git commit -m "feat(scripts): add validate-indicators prebuild guardrail"
```

---

## Phase 2: git mv 改寫檔案

### Task 2.1: git mv behavior-analysis.ts → func/objective-tests.ts

**Files:**
- Move: `src/engine/cdsa/behavior-analysis.ts` → `src/engine/func/objective-tests.ts`（已在 Phase 1 Task 1.9 create new — 此 task 把 history anchor 接好）

- [ ] **Step 1: Check if file already exists**

Run: `ls src/engine/func/objective-tests.ts`
若已存在（Task 1.9 已 create），則先把現有檔案備份 + git mv：

```bash
mv src/engine/func/objective-tests.ts /tmp/objective-tests-new.ts
git mv src/engine/cdsa/behavior-analysis.ts src/engine/func/objective-tests.ts
mv /tmp/objective-tests-new.ts src/engine/func/objective-tests.ts
```

這樣 history 接續 behavior-analysis.ts，內容是新版本。

- [ ] **Step 2: Run vitest**

Run: `pnpm vitest run tests/engine/func/objective-tests.test.ts`
Expected: pass。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(func): git mv behavior-analysis → func/objective-tests"
```

---

### Task 2.2: git mv voice-analysis.ts → func/voice-analysis.ts（S1 暫不啟用）

**Files:**
- Move: `src/engine/cdsa/voice-analysis.ts` → `src/engine/func/voice-analysis.ts`

- [ ] **Step 1: git mv**

```bash
git mv src/engine/cdsa/voice-analysis.ts src/engine/func/voice-analysis.ts
```

- [ ] **Step 2: 加 `@deprecated` 註解到檔案頂部**

開 `src/engine/func/voice-analysis.ts`，最頂部加：

```ts
/**
 * @deprecated S1: not wired, S2 verbal fluency entry-point.
 *             Adult voice analysis 需重寫（pediatric pitch 80-600Hz → adult prosody / verbal fluency）。
 */
```

- [ ] **Step 3: 同步 git mv test**

```bash
git mv tests/engine/voice-analysis.test.ts tests/engine/func/voice-analysis.test.ts
```

- [ ] **Step 4: Verify build**

Run: `pnpm check`
Expected: pass（如有 cross-import 卡到，依編譯訊息修；現存 cdsa/* 引用 voice-analysis 的話會紅，下個 phase 處理）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(func): git mv voice-analysis to func/, mark @deprecated for S2"
```

---

### Task 2.3: git mv ChildProfile.svelte → PatientProfile.svelte

**Files:**
- Move: `src/components/assess/ChildProfile.svelte` → `src/components/assess/PatientProfile.svelte`

- [ ] **Step 1: git mv**

```bash
git mv src/components/assess/ChildProfile.svelte src/components/assess/PatientProfile.svelte
```

- [ ] **Step 2: 重寫元件內容（成人 18+ 驗證）**

開 `src/components/assess/PatientProfile.svelte`，整檔內容換成：

```svelte
<script lang="ts">
  import { isAdult, isWithinValidatedRange, ageGroupAdult, type AgeGroupAdult } from '../../lib/utils/age-groups';

  let { onComplete }: {
    onComplete: (profile: { name: string; gender: 'male' | 'female' | 'other'; birthDate: string; ageGroup: AgeGroupAdult }) => void
  } = $props();

  let name = $state('');
  let gender = $state<'male' | 'female' | 'other'>('other');
  let birthDate = $state('');

  let nameError = $derived(name.trim().length === 0 ? '請輸入姓名' : '');
  let birthError = $derived(
    birthDate === '' ? '請輸入出生日期'
    : !isAdult(birthDate) ? '本系統適用於 18 歲以上'
    : ''
  );
  let canSubmit = $derived(nameError === '' && birthError === '');
  let ageAdvisory = $derived(
    birthDate !== '' && isAdult(birthDate) && !isWithinValidatedRange(birthDate)
      ? '本系統採用的篩檢工具——WHO-5 / BAT-12 / PHQ-2 / GAD-2 / PSS-4 / PROMIS Fatigue / 反應時間 / TMT-A——主要在 18-64 工作人口校準/驗證；65+ 結果僅供參考，建議使用專為高齡設計的評估（如 ICOPE / GDS-15）並向醫療人員諮詢。'
      : ''
  );

  function submit() {
    if (!canSubmit) return;
    const profile = {
      name: name.trim(),
      gender,
      birthDate,
      ageGroup: ageGroupAdult(birthDate),
    };
    onComplete(profile);
  }
</script>

<section class="patient-profile">
  <h2>受測者基本資料</h2>

  <label>
    姓名
    <input type="text" bind:value={name} />
    {#if nameError}<span class="error">{nameError}</span>{/if}
  </label>

  <label>
    性別
    <select bind:value={gender}>
      <option value="other">不便回答</option>
      <option value="female">女</option>
      <option value="male">男</option>
    </select>
  </label>

  <label>
    出生日期
    <input type="date" bind:value={birthDate} />
    {#if birthError}<span class="error">{birthError}</span>{/if}
  </label>

  {#if ageAdvisory}
    <p class="advisory">{ageAdvisory}</p>
  {/if}

  <button type="button" disabled={!canSubmit} onclick={submit}>開始評估</button>
</section>

<style>
  .patient-profile { display: flex; flex-direction: column; gap: 1rem; max-width: 480px; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--text-base, 18px); }
  input, select, button {
    font-size: var(--text-base, 18px);
    min-height: 44px;
    padding: 0.5rem;
  }
  .error { color: var(--color-risk-critical, oklch(60% 0.15 25)); font-size: var(--text-sm, 16px); }
  .advisory {
    padding: 0.75rem;
    background: var(--color-risk-advisory-bg, oklch(95% 0.05 80));
    border-left: 4px solid var(--color-risk-advisory, oklch(70% 0.15 60));
    font-size: var(--text-sm, 16px);
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(assess): rewrite ChildProfile → PatientProfile for adult 18+"
```

---

## Phase 3: schemas + age-groups + scripts 改寫

### Task 3.1: age-groups.ts 整檔重寫

**Files:**
- Modify: `src/lib/utils/age-groups.ts`

- [ ] **Step 1: 替換整檔內容**

```ts
// src/lib/utils/age-groups.ts
export const ADULT_AGE_MIN = 18 as const;
export const AGE_GROUPS_ADULT = ['18-39', '40-54', '55-64'] as const;
export type AgeGroupAdult = typeof AGE_GROUPS_ADULT[number];

export const AGE_GROUP_LABELS: Record<AgeGroupAdult, string> = {
  '18-39': '18-39 歲',
  '40-54': '40-54 歲',
  '55-64': '55-64 歲',
};

export function ageInYears(birthDate: string | Date): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  return Math.max(0, years);
}

export function isAdult(birthDate: string | Date): boolean {
  return ageInYears(birthDate) >= ADULT_AGE_MIN;
}

export function ageGroupAdult(birthDate: string | Date): AgeGroupAdult {
  const y = ageInYears(birthDate);
  if (y < 18) throw new Error(`Below adult age: ${y}`);
  if (y <= 39) return '18-39';
  if (y <= 54) return '40-54';
  return '55-64';
}

export function isWithinValidatedRange(birthDate: string | Date): boolean {
  const y = ageInYears(birthDate);
  return y >= 18 && y <= 64;
}
```

刪除舊的 `AGE_GROUPS_CDSA / AgeGroupCDSA / ageGroupCDSA / isEligible / instructionLevel / ageInMonths`（舊兒科 helpers）。

- [ ] **Step 2: Run `pnpm check`**

Expected: 大量編譯誤 — 因為其他檔案還在 import `AgeGroupCDSA` 等。**這是預期的**，後續 Task 3.2-3.5 會 cascade 修。

- [ ] **Step 3: 不 commit，繼續往下做**

下個 task 處理 schema cascade。

---

### Task 3.2: schemas.ts 刪舊 enum

**Files:**
- Modify: `src/lib/education/schemas.ts`

- [ ] **Step 1: 刪除舊 const/schema**

刪除以下 export（grep 後刪除整個區段）：
- `CDSA_DOMAIN_NAMES`
- `CDSS_INDICATOR_NAMES`
- `cdsaTriageEntrySchema`、`cdsaDomainEntrySchema`、`cdssVitalSignEntrySchema`
- `KNOWN_DOMAIN_ENUM`、`CDSS_INDICATOR_ENUM`、`CDSS_LEVEL_ENUM`、`CDSS_AGE_ENUM`
- `SEVERITY_NAMES`
- 舊 `triggerEntrySchema = z.discriminatedUnion('category', [cdsaTriageEntrySchema, cdsaDomainEntrySchema, cdssVitalSignEntrySchema])` — 改為只含 func* schemas

- [ ] **Step 2: 重組 triggerEntrySchema**

```ts
export const triggerEntrySchema = z.discriminatedUnion('category', [
  funcTriageEntrySchema,
  funcDomainEntrySchema,
]);
```

- [ ] **Step 3: 確認 `contentRelevanceSchema.inapplicable` 與 `articleRefSchema.severities` 更新**

```ts
const FUNC_TRIAGE_SEVERITY = ['observe', 'consult'] as const;

const articleRefSchema = z.object({
  slug: z.string(),
  severities: z.array(z.enum(FUNC_TRIAGE_SEVERITY)).optional(),
  browse: z.boolean().optional(),
});

export const contentRelevanceSchema = z.object({
  inapplicable: z.record(z.enum(IC_DOMAIN_NAMES), z.array(z.enum(AGE_GROUPS_ADULT))),
  triggers: z.array(triggerRelevanceSchema),
  clinicalAlertEducation: z.record(z.string(), z.array(z.string())).optional(),
});
```

- [ ] **Step 4: Run `pnpm check`**

Expected: 仍紅，但兒科 enum import 都 cascade 走 — 修剩餘 import 路徑。

```bash
# 找出所有依賴 CDSA_DOMAIN_NAMES / CDSS_INDICATOR_NAMES 等的檔案
grep -rln 'CDSA_DOMAIN_NAMES\|CDSS_INDICATOR_NAMES\|AgeGroupCDSA\|AGE_GROUPS_CDSA' src/ scripts/ tests/
```

把每個出現點改為 `IC_DOMAIN_NAMES` / `AgeGroupAdult` / `AGE_GROUPS_ADULT`（細部於後續 task）。

- [ ] **Step 5: Commit（schema 部分）**

```bash
git add src/lib/education/schemas.ts src/lib/utils/age-groups.ts
git commit -m "refactor(schemas): delete CDSA/CDSS enums, switch to IC_DOMAIN_NAMES + AGE_GROUPS_ADULT"
```

---

### Task 3.3: db/schema.ts — children→patients, RecommendationCategory, DB 名

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: 整檔 grep + replace**

```bash
# 找出位置
grep -n "children\|childId\|cdss-pediatric\|AgeGroupCDSA\|'normal' | 'monitor' | 'refer'\|RecommendationCategory" src/lib/db/schema.ts
```

依下列原則改：
- `children` table 改名 `patients`
- 所有 `childId` 欄位改 `patientId`
- DB 名 `'cdss-pediatric'` 改為 `'smart-func-cds'`
- `ageGroup: 'infant' | 'toddler' | 'preschool'` 改為 `ageGroup: AgeGroupAdult`
- `RecommendationCategory = 'normal' | 'monitor' | 'refer'` 改為 `'normal' | 'observe' | 'consult' | 'incomplete'`
- `Assessment.triageResult` 的 inline type 改用 import from `func/triage` 的 `TriageResult`

```ts
// 部分範例（前提：grep 後依檔案結構替換）
import type { TriageResult } from '../../engine/func/triage';
import type { AgeGroupAdult } from '../utils/age-groups';

export interface Patient {
  id?: number;
  name: string;
  gender: 'male' | 'female' | 'other';
  birthDate: string;
  ageGroup: AgeGroupAdult;
  createdAt: number;
}

export interface Assessment {
  id?: number;
  patientId: number;
  triageResult?: TriageResult;
  // ...其他原有欄位
}

export type RecommendationCategory = 'normal' | 'observe' | 'consult' | 'incomplete';

class FuncDB extends Dexie {
  patients!: Table<Patient, number>;
  // ... 其他 tables
  constructor() {
    super('smart-func-cds');
    this.version(1).stores({
      patients: '++id, name, birthDate, createdAt',
      // ...
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "refactor(db): rename children→patients, DB 'smart-func-cds', TriageResult import"
```

---

### Task 3.4-3.10: 連鎖修改（schemas / education modules / fhir / store / scripts / education content-relevance / branding）

> **執行說明**：每個 task 都遵循「找 import → 改名 → 跑 `pnpm check` 修剩餘紅噴 → commit」的 pattern。逐檔處理避免一次性大 PR。

### Task 3.4: db/recommendations.ts

- [ ] Modify `src/lib/db/recommendations.ts`：把 `CDSA_DOMAIN_NAMES` 換成 `IC_DOMAIN_NAMES`，`CATEGORIES = ['normal', 'monitor', 'refer']` 改 `['normal', 'observe', 'consult', 'incomplete']`，`AgeGroupCDSA` 改 `AgeGroupAdult`。
- [ ] Commit: `refactor(db): recommendations enum cascade to IC`

### Task 3.5: education modules（trigger-derivation / matrix-data / video-lookup / age-fallback）

- [ ] 逐檔把 `CDSA_DOMAIN_NAMES` → `IC_DOMAIN_NAMES`、`AGE_GROUPS_CDSA` → `AGE_GROUPS_ADULT`、`AgeGroupCDSA` → `AgeGroupAdult`、trigger format `cdsa.domain.*.anomaly.*` → `func.domain.*.<band>.*`。
- [ ] `age-fallback.ts`：兒科 7 段 fallback chain（infant/toddler/preschool/...）重寫為成人 3 段（18-39/40-54/55-64）。
- [ ] Commit each: `refactor(education): <module> cascade to IC enum`

### Task 3.6: fhir/cdsa-resources.ts + cdsa-submit.ts + assessment-fetch.ts

- [ ] `cdsa-${domain}-${metric}` code 格式改 `func-${domain}-${metric}`。
- [ ] `TriageResult` import path 從 `cdsa/triage` 改 `func/triage`。
- [ ] `SNOMED → 'monitor'/'refer' map` 改 `'observe'/'consult'/'incomplete'`。
- [ ] 整 3 個檔案保留檔名（Phase 5 才考慮 rename），先讓 import 不紅噴。
- [ ] Commit: `refactor(fhir): cdsa-* enum + TriageResult import cascade to IC`

### Task 3.7: stores/assessment.svelte.ts

- [ ] 把 `import` 從 `engine/cdsa/triage` 等改 `engine/func/...`；state 結構欄位（childId/childBirthDate/ageGroup type）改用 `AgeGroupAdult`、`patientId`。
- [ ] Commit: `refactor(store): assessment.svelte.ts cascade to IC`

### Task 3.8: scripts/build-questionnaire-applicability.ts

- [ ] CDSA domain hardcode 列表改 `IC_DOMAIN_NAMES`；trigger format 改 `func.*`；age groups 改 `AGE_GROUPS_ADULT`。
- [ ] 同時也更新 `scripts/curate/keywords.json`：把兒科 keywords（"嬰幼兒"、"幼兒發展" 等）替換為成人 keywords（"工作壓力"、"睡眠品質"、"認知健康" 等）。
- [ ] Commit: `refactor(scripts): build-questionnaire-applicability + curate/keywords cascade to IC`

### Task 3.9: src/data/education/content-relevance.yaml（Phase 3a 過渡 stub）

- [ ] Replace 整檔為 minimal stub（5 IC domain × 2 band × 3 age = 30 triggers，全 empty articles）：

```yaml
# src/data/education/content-relevance.yaml
inapplicable: {}
triggers:
  - { trigger: func.domain.vitality.low.18-39, category: domain, domain: vitality, band: low, ageGroup: "18-39", videoIds: [], articles: [] }
  - { trigger: func.domain.vitality.moderate.18-39, category: domain, domain: vitality, band: moderate, ageGroup: "18-39", videoIds: [], articles: [] }
  # ... 跨 5 domain × 2 band × 3 age = 30 條（手寫或腳本生成）
  - { trigger: func.triage.normal.18-39, category: triage, triageCategory: normal, ageGroup: "18-39", videoIds: [], articles: [] }
  # ... 跨 4 category × 3 age = 12 條
```

> 為了快速：可用一個 small node 腳本生成這 42 行 yaml。詳細內容於 S3 補。

- [ ] Run `pnpm check && pnpm build` 確認 Astro Content Layer 通過 schema 驗證。
- [ ] Commit: `refactor(content): content-relevance.yaml Phase 3a minimal stub`

### Task 3.10: pages/education/index.astro

- [ ] `import { CDSA_DOMAINS, AGE_GROUPS_CDSA }` 改 `import { IC_DOMAIN_NAMES, AGE_GROUPS_ADULT }`。
- [ ] 矩陣顯示 5×3 cell。
- [ ] Commit: `refactor(pages): education/index.astro cascade to IC`

---

## Phase 4: UI 元件 cascade

### Task 4.1: AssessmentShell.svelte — 模組陣列

- [ ] 刪除 `import DrawingModule / GameModule / VideoModule`。
- [ ] `import ChildProfile` 改 `import PatientProfile`。
- [ ] 模組陣列由 `[ChildProfile, GameModule, DrawingModule, VoiceModule, VideoModule, QuestionnaireModule]` 改 `[PatientProfile, QuestionnaireModule]`（S1 範圍）。
- [ ] Commit: `refactor(assess): AssessmentShell module list to IC`

### Task 4.2: QuestionnaireModule.svelte

- [ ] 讀取 `src/data/questionnaire/indicators.yaml`（透過 build-time generated index）。
- [ ] 依 indicator schema 動態渲染（Likert → radio group / objective → 互動測試 component）。
- [ ] 把 6 兒科域 hardcode 換成 5 IC domain 動態載入。
- [ ] Commit: `refactor(assess): QuestionnaireModule wired to indicators.yaml + 5 IC domains`

### Task 4.3: RadarChart.svelte — 5 軸

- [ ] 把 6 軸 props 改 5 軸。
- [ ] band color from design tokens：`high` → `--color-risk-normal`、`moderate` → `--color-risk-advisory`、`low` → `--color-risk-warning`。
- [ ] Untested domain：軸線虛線 + 「未測」標籤。
- [ ] 軸 click → drill-down indicator-level（charter §0.2 病患為主）。
- [ ] Commit: `refactor(assess): RadarChart 6-axis → 5-axis IC`

### Task 4.4-4.13: 其他 UI 元件

依 spec §5.3b 表逐檔處理：

- [ ] **Task 4.4** ResultView.svelte：`monitor`/`refer` → `observe`/`consult`/`incomplete`、import `func/triage` 型別。
- [ ] **Task 4.5** ResultViewWrapper.svelte：`ageGroupCDSA` → `ageGroupAdult`。
- [ ] **Task 4.6** AssessmentPdfReport.svelte：`ageInMonths` → `ageInYears`。
- [ ] **Task 4.7** AssessmentHistory.svelte：兒科 age display 改成人格式。
- [ ] **Task 4.8** EducationMatch.svelte：category enum cascade。
- [ ] **Task 4.9** patient/ResultDetail.svelte：`ageGroupCDSA` + `childBirthDate` 改 adult。
- [ ] **Task 4.10** patient/ReportExport.svelte：'CDSS 兒科' 文案改 'Smart Func 成人功能健康評估'。
- [ ] **Task 4.11** workspace/AssessmentsTab.svelte：`Category` type 改 4 類、`childId` → `patientId`。
- [ ] **Task 4.12** workspace/GuideTab.svelte：兒科文案改成人。
- [ ] **Task 4.13** settings/RecommendationsManager.svelte：category enum 4 類；default `'monitor'` → `'observe'`。
- [ ] **Task 4.14** settings/NormsManager.svelte：`AgeGroupCDSA` → `AgeGroupAdult`、`'25-36m'` default → `'18-39'`。

每 task 一個 commit：`refactor(<area>): <component> cascade to IC`。

---

## Phase 5: 刪除兒科檔案

### Task 5.1: 刪除 cdsa/ 引擎檔

```bash
git rm src/engine/cdsa/drawing-analysis.ts
git rm src/engine/cdsa/gross-motor-analysis.ts
git rm src/engine/cdsa/card-selector.ts
git rm src/engine/cdsa/assessment-analyzer.ts
git rm src/engine/cdsa/triage.ts
git rm src/engine/cdsa/radar-scoring.ts
```

`behavior-analysis.ts` 已於 Phase 2 git mv，voice-analysis 亦同。

- [ ] Run `pnpm check`：若仍有 import cdsa/* 的點，cascade fix。
- [ ] Commit: `chore: delete pediatric cdsa engine modules`

### Task 5.2: 刪除 cdsa/ 整資料夾（剩餘）

```bash
rmdir src/engine/cdsa/  # 應該已空
```

- [ ] Commit: `chore: remove empty cdsa/ folder`

### Task 5.3: 刪除 UI 元件

```bash
git rm src/components/assess/DrawingModule.svelte
git rm src/components/assess/GameModule.svelte
git rm src/components/assess/VideoModule.svelte
```

- [ ] Commit: `chore: delete pediatric UI modules (Drawing/Game/Video)`

### Task 5.4: 刪除模型與資料

```bash
git rm public/models/drawing-classifier.onnx
git rm src/data/cards/index.json
git rm src/data/baselines/pediatric-baselines.json
git rm src/data/rules/pediatric-default.yaml
git rm src/data/questionnaire/questions.json
```

- [ ] Commit: `chore: delete pediatric ONNX + cards + baselines + rules + questions.json`

---

## Phase 6: 測試清理

### Task 6.1: 刪除過時測試

```bash
git rm tests/engine/drawing-analysis.test.ts
git rm tests/engine/card-selector.test.ts
git rm tests/engine/assessment-analyzer.test.ts
git rm tests/components/ChildProfile.test.ts
```

- [ ] Commit: `chore(test): delete pediatric-only tests`

### Task 6.2: git mv tests

```bash
git mv tests/engine/radar-scoring.test.ts tests/engine/func/radar-scoring.test.ts
git mv tests/engine/triage.test.ts tests/engine/func/triage.test.ts
git mv tests/engine/behavior-analysis.test.ts tests/engine/func/objective-tests.test.ts  # 若 Phase 1 已 create new，先備份再 git mv
```

- [ ] Commit: `chore(test): git mv engine tests to func/`

### Task 6.3: 重寫 moved tests 內容

- [ ] 把 `radar-scoring.test.ts` 改測 `func/radar-scoring` 5 軸（用 Phase 1 Task 1.8 撰寫的測試取代）。
- [ ] `triage.test.ts` 改測 4 類分流（Phase 1 Task 1.6）。
- [ ] `objective-tests.test.ts` 改測 RT + TMT-A runner（Phase 1 Task 1.9）。
- [ ] Commit: `test(func): rewrite moved tests for IC modules`

### Task 6.4: skip 守門 tests

加 `test.skip` 到下列檔案，並加 `TODO: revive in S3/S5` 註解：

```bash
# 以 file-edit 方式逐個加 test.skip
# tests/education/content-index-parity.test.ts → S3
# tests/data/education-slug-integrity.test.ts → S3
# tests/seo/schema.test.ts → S5
# tests/seo/positioning.test.ts → S5
```

- [ ] Commit: `test: skip守門 tests pending S3/S5 content rewrite`

### Task 6.5: 重寫成人版測試

- [ ] `tests/db/recommendations-age.test.ts`：fixture 用 adult ages，category 4 類。
- [ ] `tests/components/RadarChart.test.ts`：5 軸測試。
- [ ] `tests/components/ResultView.test.ts`：4 類 category 顯示。
- [ ] `tests/components/QuestionnaireModule.test.ts`：5 IC domain + indicators.yaml 驅動。
- [ ] `tests/components/PatientProfile.test.ts`：18+ 驗證、advisory copy。
- [ ] `tests/utils/age-groups.test.ts`：成人年齡測試（已於 Phase 0 Task 0.2 寫）。
- [ ] Commit: `test: rewrite components / db / utils tests for adult IC`

### Task 6.6: end-to-end integration test

```ts
// tests/engine/func/end-to-end-scoring.test.ts
import { describe, it, expect } from 'vitest';
import { scoreAssessment } from '../../../src/engine/func/scorer';
import { computeTriage } from '../../../src/engine/func/triage';
import { buildRadarData } from '../../../src/engine/func/radar-scoring';
import { indicatorSchema, type Indicator } from '../../../src/engine/func/questionnaire';
import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';

const yamlPath = path.join(process.cwd(), 'src/data/questionnaire/indicators.yaml');
const raw = yaml.load(fs.readFileSync(yamlPath, 'utf8')) as Record<string, unknown[]>;

const indicators: Indicator[] = [];
for (const list of Object.values(raw)) {
  for (const ind of list as unknown[]) {
    indicators.push(indicatorSchema.parse(ind));
  }
}

describe('end-to-end IC assessment', () => {
  it('healthy adult: all Likert min answers (= max capacity) → normal triage', () => {
    const answers: Record<string, number> = {};
    for (const ind of indicators) {
      if (ind.kind !== 'likert') continue;
      const minS = ind.minScore ?? 0;
      const maxS = ind.maxScore;
      for (const q of ind.questions) {
        // direction=higher_is_better → answer max (best); higher_is_worse → answer min (best)
        answers[q.id] = ind.direction === 'higher_is_better' ? maxS : minS;
      }
    }
    const scored = scoreAssessment({ indicators, answers, objectiveResults: {}, ageGroup: '18-39' });

    // objective indicators 無 norm → 不被計分；只取 likert
    const triage = computeTriage({
      indicatorScores: scored.indicatorScores,
      domainScores: scored.domainScores,
      applicableWeights: scored.applicableWeights,
      ageGroup: '18-39',
      assessmentDate: '2026-05-28',
    });

    expect(triage.completedDomains).toBeGreaterThanOrEqual(3);
    expect(['normal', 'observe']).toContain(triage.category);  // 視 objective 是否計分

    const radar = buildRadarData(triage, scored.indicatorScores);
    expect(radar.axes).toHaveLength(5);
  });
});
```

- [ ] Run: `pnpm vitest run tests/engine/func/end-to-end-scoring.test.ts`
- [ ] Commit: `test(func): end-to-end integration test for full IC flow`

### Task 6.7: Final build verification

- [ ] Run all checks:

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
```

每個都應綠燈。任何紅噴對應 cascade 沒清的點，逐個修。

- [ ] Commit final: `chore: final build verification S1 complete`

---

## Self-Review（已執行於 plan 撰寫後）

**Spec coverage check**：
- §1 Schema 改造 → Phase 0/3 涵蓋 ✓
- §2 Indicator schema → Phase 1 Task 1.2 / indicators.yaml Task 1.10 ✓
- §3 計分契約 → Phase 1 Task 1.3-1.5（含 BAT-12 公式 critical 驗算）✓
- §4 分流 + 雷達 → Phase 1 Task 1.6/1.7/1.8 ✓
- §5 兒科退場 → Phase 2/5 ✓
- §6 FHIR + tests → 大部分 FHIR 寫回（Bundle/Provenance/Device 等）defer 至 **後續 plan（S2 / S4）**。S1 plan 範圍：indicator schema + scorer + triage + radar + UI shell。FHIR write-back 模組是 S2 範疇（spec §0.4 + open Q）。

**FHIR scope 縮減說明**：本 plan 把 FHIR 寫回 module（`src/lib/fhir/func-submit.ts` 等）defer 至 S2 plan。S1 範圍是 schema + engine + UI shell（讓系統能 score + 顯示雷達 + 顯示分流）。Optional FHIR connect 流程屬 S2/S4。

**Placeholder scan**：本 plan 內無「TBD」「TODO」（除了 indicators.yaml 內 objective norm 是設計合理 placeholder，等 implementation phase 引文獻填）。
**Type consistency**：scorer.ts 的 `IndicatorScore.score: number` 與 triage.ts 的 `domainScores: DomainScore[]` 一致；`Recommendation` interface 於 triage.ts 定義 + recommendations.ts 使用 — 一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-s1-core-schema-and-step1-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (跨 Phase 0-6 約 50+ tasks), review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
