# S1 — Core Schema + Step 1 + Pediatric Retirement (Design v4)

> **Date**: 2026-05-28
> **Status**: Draft v4 — addressed round 3 Opus reviewers (7 new critical + 23 major fixed)
> **Scope**: 第 1 個 slice（共 5 個）的 smart-func-cds 轉型設計
> **Anchors**:
> - Charter: [`docs/superpowers/specs/2026-05-28-smart-func-cds-charter.md`](./2026-05-28-smart-func-cds-charter.md)
> - Research: [`docs/superpowers/research/2026-05-28-who-ic-framework-research.md`](../research/2026-05-28-who-ic-framework-research.md)

## v4 修訂摘要（round 3 Opus review 回應）

| 議題 | 提出者 | v4 處理 |
|---|---|---|
| **§3.1 BAT-12 歸一公式對 1-based scale 數學錯誤** | Clinical NC1 + Engineering NC1 | 公式改為 `(adjustedSum - N*minScore) / (N*range)`，驗算全答 1 → 100、全答 5 → 0、mid 3 → 50 |
| **PSS-4 缺 clinicalCutoff** | Clinical NC2 | 加 `threshold: 9, severity: advisory, citation: "Cohen 1988 (PSS-4 short form) + Warttig 2013"` |
| **WHO-5 缺 `minCompletionPolicy: 1.0`** | Clinical NC3 | 加 `minCompletionPolicy: 1.0`（WHO-5 manual 要求全 5 題） |
| **BAT-12 缺另 3 個 subscale cutoffs** | Clinical M1 | 加 mental_distance ≥2.81 / cognitive ≥2.41 / emotional ≥2.61（Schaufeli 2020 + De Beer 2020）|
| **BAT-12 缺 minCompletionPolicy** | Clinical M3 | 加 `minCompletionPolicy: 1.0` |
| **LOINC canonical URL pattern 錯誤** `/Questionnaire/55757-9` 不存在 | FHIR NC1 | 改 `http://loinc.org/q/55757-9` |
| **PROMIS Fatigue 4a LOINC `76342-5` 存在卻標 TBD** | FHIR NC2 | 改 `loincCode: "76342-5"` |
| **§5.3 cascade 仍漏 8+ 檔** | Engineering NC2 | 補 ResultView / NormsManager / curate keywords / 15+ tests |
| **Observation.interpretation 兩個獨立 CodeableConcept 錯誤** | FHIR M1 | 合併為單一 CodeableConcept 多 coding |
| **SNOMED 706689003 display string 應為 "programme"** | FHIR M2 | 改英式拼字 |
| **CodeSystem 5/6/7 counter mismatch** | FHIR M8 + Engineering NM12 / MJ-v3-4 | 全文統一 **8 個**（加入 ic-subscale 拆出後）|
| **`applicableWeights: Map` 序列化問題** | Engineering MJ-v3-1 | 改 `Record<string, number>` |
| **`LikertQuestion.loincCode` 缺 schema 欄位** | Engineering MJ-v3-5 | 加欄位，PHQ-2 / GAD-2 統一走 schema |
| **sensory.functional_acuity license 誤標 public-domain** | Clinical M2 | 改 `study-developed` license（schema 加此 enum）+ §8 open Q 列 HHIE-S 替代 |
| **`possibleMax` dead variable** | Engineering MJ-v3-6 | 刪除 |
| **§3.x / §4.x / §5.x「如 v2 省略」不自含** | Engineering MN-v3-7 | inline 全部內容 |
| **65+ advisory 在 charter 與 spec 不一致** | Charter NM-R3-1 | charter 已修為 ICOPE / GDS-15 並列 |
| **Device resource 缺 charter 條** | Charter NM-R3-2 | charter §0.4 已加 Device 行 |
| **minScore + minCompletionPolicy 缺 charter** | Charter NM-R3-3 | charter §0.6 Likert 解析度行已修 |
| **ic-score-component CodeSystem 混 generic + instrument-specific** | Engineering MJ-v3-2 | 拆出 `ic-subscale` CodeSystem |
| **`derivedFrom` LOINC q URL 全部修正** | FHIR C1 | spec §6.1 / §0.5 同步 |

---

## 目錄

- [§1 Schema 改造與模組架構](#1-schema-改造與模組架構)
- [§2 Layer 2 Indicator Schema](#2-layer-2-indicator-schema)
- [§3 計分契約](#3-計分契約)
- [§4 分流邏輯 + 5 軸雷達 v1](#4-分流邏輯--5-軸雷達-v1)
- [§5 兒科退場清單與影響](#5-兒科退場清單與影響)
- [§6 FHIR 映射 + 測試策略](#6-fhir-映射--測試策略)
- [§7 議定參數總表](#7-議定參數總表)
- [§8 Open questions](#8-open-questions)
- [§9 SMART Launch 細部](#9-smart-launch-細部)
- [§10 變更紀錄](#10-變更紀錄)

---

## §1 Schema 改造與模組架構

> **對齊**: charter §0.1 修訂版 / §0.2 / §0.6 修訂版

### 1.1 Domain enum

```ts
// src/lib/education/schemas.ts
export const IC_DOMAIN_NAMES = [
  'vitality', 'locomotion', 'cognition', 'psychological', 'sensory'
] as const;
export type ICDomain = typeof IC_DOMAIN_NAMES[number];
```

刪除：`CDSA_DOMAIN_NAMES`、`CDSS_INDICATOR_NAMES`、`cdssVitalSignEntrySchema`、`CDSS_AGE_ENUM`、`SEVERITY_NAMES`、舊三類 `RecommendationCategory`。

### 1.2 年齡資格

```ts
export const ADULT_AGE_MIN = 18 as const;
export const AGE_GROUPS_ADULT = ['18-39', '40-54', '55-64'] as const;
export type AgeGroupAdult = typeof AGE_GROUPS_ADULT[number];

export function ageGroupAdult(birthDate: string | Date): AgeGroupAdult;
export function isAdult(birthDate: string | Date): boolean;
export function isWithinValidatedRange(birthDate: string | Date): boolean;
```

65+ UI advisory（對齊 charter §0.1 修訂版 + round 3 Charter NM-R3-1）：

> 「本系統採用的篩檢工具——WHO-5 / BAT-12 / PHQ-2 / GAD-2 / PSS-4 / PROMIS Fatigue 4a / 反應時間 / TMT-A——主要在 18-64 工作人口校準/驗證；65+ 結果僅供參考，**建議使用專為高齡設計的評估（如 ICOPE / GDS-15）**，並向醫療人員諮詢。」

### 1.3 Trigger naming

| 形式 | 用途 |
|---|---|
| `func.domain.<domain>.<band>.<ageGroup>` | band ∈ low / moderate |
| `func.triage.<category>.<ageGroup>` | category ∈ normal / observe / consult / incomplete |
| `func.consult.<domain>` | 建議找醫師討論的內容 |
| `func.selfcare.<domain>` | 自我管理建議內容 |
| `func.indepth.<domain>` | S2 預留 |
| `func.followup.<domain>` | S4 預留 |

### 1.4 模組架構

```
src/engine/func/
  questionnaire.ts          # Indicator schema + YAML loader
  scorer.ts                 # Likert + objective → indicator → domain 0-100
  triage.ts                 # 5-domain → normal/observe/consult/incomplete
  radar-scoring.ts          # 5-domain → 雷達資料
  objective-tests.ts        # 反應時間 + TMT-A 量測
  recommendations.ts        # 建議科別對照表
  utils.ts                  # zToPercentile + reverse scoring + median

src/engine/                 # 既有跨切面模組保留
src/engine/cdsa/            # 整資料夾刪除
```

### 1.5 Schema 改名／退場一覽

| 舊 | 新 | 動作 |
|---|---|---|
| `CDSA_DOMAIN_NAMES` | `IC_DOMAIN_NAMES` | 替換 |
| `AGE_GROUPS_CDSA` / `AgeGroupCDSA` | `AGE_GROUPS_ADULT` / `AgeGroupAdult` | 替換 |
| `cdsaTriageEntrySchema` | `funcTriageEntrySchema` | 替換 |
| `cdsaDomainEntrySchema` | `funcDomainEntrySchema` | 替換 |
| `cdssVitalSignEntrySchema` / `CDSS_INDICATOR_NAMES` / `CDSS_AGE_ENUM` | — | 刪除 |
| `SEVERITY_NAMES` 舊三類 | 刪除（band/category 各自獨立 CodeSystem）| 刪除 |
| `triggerEntrySchema` discriminatedUnion | 改寫只含 funcTriage / funcDomain | 替換 |
| `Assessment.triageResult` inline type（DB schema 內）| 改新 TriageResult | 替換 |
| `RecommendationCategory: 'monitor' \| 'refer'` | `'normal' \| 'observe' \| 'consult' \| 'incomplete'` | 替換 |

### 1.6 TriageResult forward reference

完整 type 定義於 §4.7。

---

## §2 Layer 2 Indicator Schema

> **對齊**: charter §0.3 修訂版（capacity + symptom 混用、cutoff severity 2 級、每 domain ≥1 capacity）· §0.5 修訂版（量表 LOINC 5 處修正 + BAT-12 1-5 Likert）· §0.6 修訂版（Likert 解析度 + minScore + minCompletionPolicy + reverseScored）

### 2.1 共用 runtime 常數 + Base Indicator

```ts
// src/engine/func/questionnaire.ts
export const INDICATOR_KINDS = ['likert', 'objective'] as const;
export type IndicatorKind = typeof INDICATOR_KINDS[number];

export const INDICATOR_STYLES = ['capacity', 'symptom'] as const;
export type IndicatorStyle = typeof INDICATOR_STYLES[number];

export const DIRECTION_KINDS = ['higher_is_better', 'higher_is_worse'] as const;
export type Direction = typeof DIRECTION_KINDS[number];

export const LICENSE_KINDS = [
  'public-domain',
  'cc-by',
  'cc-by-sa',
  'cc-by-nc-sa',
  'research-open-noncommercial',
  'study-developed',                         // round 3 clinical M2: 自製 indicator 用此（非洗白 public-domain）
  'commercial',                              // build-time validator 拒絕
] as const;
export type License = typeof LICENSE_KINDS[number];

interface BaseIndicator {
  id: string;                                // 必須符合 /^<domain>\..+$/，validator 守門
  domain: ICDomain;
  label: string;
  style: IndicatorStyle;
  direction: Direction;
  weight: number;                            // [0, ∞)，0 排除聚合
  ageApplicability?: AgeGroupAdult[];
  license: License;
  loincCode?: string;
}

export type Indicator = LikertIndicator | ObjectiveIndicator;
```

### 2.2 Likert Indicator

```ts
export interface LikertIndicator extends BaseIndicator {
  kind: 'likert';
  maxScore: number;                          // 1-10 sane bound（validator）
  minScore?: number;                         // 預設 0；BAT-12 等 1-based scale 設 1
  questions: LikertQuestion[];
  subScales?: LikertSubScale[];
  clinicalCutoff?: ClinicalCutoff;
  minCompletionPolicy?: number;              // [0, 1]，覆寫全域規則
}

export interface LikertQuestion {
  id: string;                                // `<indicator.id>.q<n>`
  text: string;
  reverseScored?: boolean;
  loincCode?: string;                        // round 3 engineering MJ-v3-5: 個別題 LOINC
  options: Array<{ label: string; score: number }>;  // score 在 [minScore, maxScore]
}

export interface LikertSubScale {
  id: string;
  label: string;
  questionIds: string[];
  weight?: number;                           // 預設 1.0；S1 內報告用，indicator overall 計分不用 weight
  clinicalCutoff?: ClinicalCutoff;
}

export interface ClinicalCutoff {
  threshold: number;
  comparator: '>=' | '<=';
  flagLabel: string;
  severity: 'consult' | 'advisory';
  citation: string;
}
```

### 2.3 Objective Indicator

```ts
export interface ObjectiveIndicator extends BaseIndicator {
  kind: 'objective';
  test: ObjectiveTest;
}

export type ObjectiveTest = ReactionTimeTest | TmtATest;

export interface NormSpec {
  mean: number;
  std: number;
  citation: string;
}

export interface ReactionTimeTest {
  type: 'reaction-time';
  paradigm: 'simple-visual';
  trials: number;
  warmupTrials: number;
  validRangeMs: { min: 100; max: 2000 };
  norms: Record<AgeGroupAdult, NormSpec | null>;   // null = dev placeholder
}

export interface TmtATest {
  type: 'tmt-a';
  targetCount: 25;
  administration: 'browser-mouse' | 'browser-touch';
  norms: Record<AgeGroupAdult, NormSpec | null>;
}
```

### 2.4 5-Domain Indicator 骨架（v4 含全部修正）

```yaml
# src/data/questionnaire/indicators.yaml

vitality:
  - id: vitality.sleep_quality
    kind: likert
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
  - id: vitality.appetite
    kind: likert
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
  - id: vitality.weight_stability
    kind: likert
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
  - id: vitality.fatigue                                                    # PROMIS Fatigue Short Form 4a
    kind: likert
    style: symptom
    direction: higher_is_worse
    maxScore: 4
    weight: 1.0
    license: cc-by-nc-sa
    loincCode: "76342-5"                                                    # ← v4 round 3 FHIR NC2 修正：4a panel LOINC 存在

locomotion:
  - id: locomotion.activity_level
    kind: likert
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
  - id: locomotion.sedentary_time
    kind: likert
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
  - id: locomotion.walking_ability
    kind: likert
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain

cognition:
  - id: cognition.attention_self_report
    kind: likert
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
  - id: cognition.memory_self_report
    kind: likert
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: public-domain
  - id: cognition.processing_speed
    kind: objective
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
        "18-39": null
        "40-54": null
        "55-64": null
  - id: cognition.executive_function
    kind: objective
    style: capacity
    direction: higher_is_worse
    weight: 1.0
    license: research-open-noncommercial
    test:
      type: tmt-a
      targetCount: 25
      administration: browser-mouse
      norms:
        "18-39": null
        "40-54": null
        "55-64": null

psychological:
  - id: psychological.wellbeing                                              # WHO-5
    kind: likert
    style: capacity
    direction: higher_is_better
    maxScore: 5
    weight: 1.0
    license: cc-by-nc-sa
    loincCode: null                                                          # WHO-5 無 LOINC，用 local
    minCompletionPolicy: 1.0                                                 # ← v4 round 3 clinical NC3 修正：manual 要求 100%
    clinicalCutoff:
      threshold: 13
      comparator: "<="
      flagLabel: low-wellbeing-screen
      severity: advisory
      citation: "Topp CW et al. Psychother Psychosom 2015;84:167-176 (cutoff raw≤13 ≈ %≤52)"
  - id: psychological.burnout                                                # BAT-12 1-5 Likert
    kind: likert
    style: symptom
    direction: higher_is_worse
    maxScore: 5
    minScore: 1
    weight: 1.0
    license: cc-by-nc-sa
    minCompletionPolicy: 1.0                                                 # ← v4 round 3 clinical M3 修正
    subScales:
      - id: bat12.exhaustion
        label: 精疲力竭
        questionIds: [psychological.burnout.q1, psychological.burnout.q2, psychological.burnout.q3]
        clinicalCutoff:
          threshold: 2.96
          comparator: ">="
          flagLabel: bat12-exhaustion-redzone
          severity: advisory
          citation: "Schaufeli/De Witte/Desart 2020 BAT manual + De Beer 2020 short-form validation"
      - id: bat12.mental_distance                                            # ← v4 round 3 clinical M1 修正
        label: 心理疏離
        questionIds: [psychological.burnout.q4, psychological.burnout.q5, psychological.burnout.q6]
        clinicalCutoff:
          threshold: 2.81
          comparator: ">="
          flagLabel: bat12-mental-distance-redzone
          severity: advisory
          citation: "Schaufeli 2020 BAT manual"
      - id: bat12.cognitive_impairment
        label: 認知失能
        questionIds: [psychological.burnout.q7, psychological.burnout.q8, psychological.burnout.q9]
        clinicalCutoff:
          threshold: 2.41
          comparator: ">="
          flagLabel: bat12-cognitive-impairment-redzone
          severity: advisory
          citation: "Schaufeli 2020 BAT manual"
      - id: bat12.emotional_impairment
        label: 情緒失調
        questionIds: [psychological.burnout.q10, psychological.burnout.q11, psychological.burnout.q12]
        clinicalCutoff:
          threshold: 2.61
          comparator: ">="
          flagLabel: bat12-emotional-impairment-redzone
          severity: advisory
          citation: "Schaufeli 2020 BAT manual"
  - id: psychological.depression                                             # PHQ-2
    kind: likert
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    loincCode: "55757-9"                                                     # panel
    minCompletionPolicy: 1.0
    questions:
      - { id: psychological.depression.q1, text: "...", loincCode: "44250-9", reverseScored: false, options: [...] }
      - { id: psychological.depression.q2, text: "...", loincCode: "44255-8", reverseScored: false, options: [...] }
    clinicalCutoff:
      threshold: 3
      comparator: ">="
      flagLabel: positive-depression-screen
      severity: advisory
      citation: "Kroenke 2003 (sens 83% / spec 92%)"
  - id: psychological.anxiety                                                # GAD-2
    kind: likert
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    loincCode: null                                                          # GAD-2 無 panel LOINC
    minCompletionPolicy: 1.0
    questions:
      - { id: psychological.anxiety.q1, text: "...", loincCode: "69725-0", reverseScored: false, options: [...] }
      - { id: psychological.anxiety.q2, text: "...", loincCode: "68509-9", reverseScored: false, options: [...] }
    clinicalCutoff:
      threshold: 3
      comparator: ">="
      flagLabel: positive-anxiety-screen
      severity: advisory
      citation: "Kroenke 2007 (sens 86% / spec 83%)"
  - id: psychological.stress                                                 # PSS-4
    kind: likert
    style: symptom
    direction: higher_is_worse
    maxScore: 4
    weight: 1.0
    license: research-open-noncommercial
    minCompletionPolicy: 1.0
    questions:
      - { id: psychological.stress.q1, text: "過去 1 個月內，您多常感到無法掌控生活中的重要事情？", reverseScored: false, options: [...] }
      - { id: psychological.stress.q2, text: "過去 1 個月內，您多常感到能掌握自己的時間？", reverseScored: true, options: [...] }
      - { id: psychological.stress.q3, text: "過去 1 個月內，您多常感到事情如您所願？", reverseScored: true, options: [...] }
      - { id: psychological.stress.q4, text: "過去 1 個月內，您多常感到困難堆積到無法克服？", reverseScored: false, options: [...] }
    clinicalCutoff:                                                          # ← v4 round 3 clinical NC2 修正
      threshold: 9
      comparator: ">="
      flagLabel: positive-stress-screen
      severity: advisory
      citation: "Cohen 1988 (PSS-4 short form) + Warttig 2013 UK norms（PSS-4 sum ≥9 為 high stress top 20 percentile）"

sensory:
  - id: sensory.functional_acuity                                            # ← v4 round 3 clinical M2: license 修正
    kind: likert
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: study-developed                                                 # 標明自製非 validated
    # 互動實作期可改用 HHIE-S (Hearing Handicap Inventory Screening, public-domain, 10 題)
    # 與獨立視覺自陳。詳 §8 open Q #11
  - id: sensory.vision_impact
    kind: likert
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
  - id: sensory.hearing_impact
    kind: likert
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
  - id: sensory.screen_fatigue
    kind: likert
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
```

### 2.5 Domain 與 Indicator 預估題量

| Domain | Indicator 數 | S1 題數 |
|---|---|---|
| Vitality | 4 | ~9-11 |
| Locomotion | 3 | ~5-8 |
| Cognition | 2 Likert + 2 objective | 4-6 + RT 30s + TMT 60s |
| Psychological | 5 (WHO-5 5 + BAT-12 12 + PHQ-2 2 + GAD-2 2 + PSS-4 4) | **25** |
| Sensory | 4 | 4-5 |
| **合計** | — | **~50-55 + 2 互動測試 ≈ 13-17 分** |

### 2.6 退場 / 改寫對照

如 v3，§5 詳細展開。

---

## §3 計分契約

> **對齊**: charter §0.3 修訂版 · §0.4 修訂版 · §0.6 修訂版（公式 + minScore + minCompletionPolicy + reverseScored）

### 3.1 Likert Indicator 計分（v4 critical 公式修正）

```ts
// src/engine/func/scorer.ts

function scoreLikertIndicator(
  indicator: LikertIndicator,
  answers: Record<string, number>,
): IndicatorScore | null {
  const N = indicator.questions.length;
  const minScore = indicator.minScore ?? 0;
  const maxScore = indicator.maxScore;
  const range = maxScore - minScore;          // BAT-12: 5-1=4；PHQ-2: 3-0=3
  if (range <= 0) {
    throw new Error(`Invalid scale for ${indicator.id}: maxScore must > minScore`);
  }

  // 1. 取所有有效回答 + 反向計分
  const validAnswerEntries = indicator.questions
    .map(q => ({
      qid: q.id,
      raw: answers[q.id],
      reverseScored: q.reverseScored ?? false,
    }))
    .filter(e => Number.isFinite(e.raw));

  if (validAnswerEntries.length === 0) return null;

  // 2. 最小完成題數
  const policy = indicator.minCompletionPolicy
    ?? (N <= 4 ? 1.0 : 0.5);
  const minRequired = Math.ceil(N * policy);
  if (validAnswerEntries.length < minRequired) return null;

  // 3. 反向計分套用：raw → effective
  const effectiveAnswers = validAnswerEntries.map(e => ({
    qid: e.qid,
    effective: e.reverseScored ? (maxScore - e.raw + minScore) : e.raw,
  }));

  const rawSum = effectiveAnswers.reduce((s, e) => s + e.effective, 0);
  const adjustedSum = (rawSum / effectiveAnswers.length) * N;  // 推估到 N 題

  // 4. 歸一化到 [0, 1] capacity-direction（v4 round 3 critical 修正）
  //    公式: (adjustedSum - N * minScore) / (N * range)
  //    驗算 BAT-12 (minScore=1, maxScore=5, N=12):
  //    - 全答 1 (best): adjustedSum=12, raw=(12-12)/(12*4)=0, capacity=1-0=1.0=100 ✓
  //    - 全答 5 (worst): adjustedSum=60, raw=(60-12)/48=1.0, capacity=1-1.0=0=0 ✓
  //    - 全答 3 (mid): adjustedSum=36, raw=(36-12)/48=0.5, capacity=1-0.5=0.5=50 ✓
  const raw = (adjustedSum - N * minScore) / (N * range);
  const capacity = indicator.direction === 'higher_is_better' ? raw : 1 - raw;

  // 5. Cutoff: 對「反向計分套用後的實答 raw sum」比較，僅完整作答時計算
  let cutoffFlag: boolean | undefined;
  let cutoffSeverity: 'consult' | 'advisory' | undefined;
  if (indicator.clinicalCutoff && validAnswerEntries.length === N) {
    const { threshold, comparator, severity } = indicator.clinicalCutoff;
    cutoffFlag = comparator === '>=' ? rawSum >= threshold : rawSum <= threshold;
    if (cutoffFlag) cutoffSeverity = severity;
  }

  // 6. Sub-scale 計分（BAT-12 等）
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

**Invariants**（cutoffFlag / cutoffSeverity 三態）：
- 兩者 `undefined` ↔ cutoff 未算（無 clinicalCutoff 或 incomplete）
- `flag=false, severity=undefined` ↔ 算了未觸發
- `flag=true, severity ∈ {consult, advisory}` ↔ 觸發

### 3.2 Objective Indicator 計分

```ts
function scoreObjectiveIndicator(
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
    if (import.meta.env.PROD) {
      throw new Error(`Norm for ${indicator.id}@${ageGroup} is null in prod build`);
    }
    return null;
  }
  const { mean: normMean, std: normStd } = norm;
  if (normStd <= 0 || normStd < Math.abs(normMean) * 0.01) return null;

  let z = (measuredValue - normMean) / normStd;
  if (indicator.direction === 'higher_is_worse') z = -z;
  z = Math.max(-4, Math.min(4, z));

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

### 3.3 Indicator 雙重表徵（capacity score + clinical cutoff）

每個 IndicatorScore 同時暴露：
- `score`: 0-100 capacity score（雷達 + domain 加權聚合用）
- `rawSum`: 原 Likert sum（反向計分套用後）
- `cutoffFlag`: 觸發 cutoff 為 true（§3.1 邏輯）
- `cutoffSeverity`: 'consult' / 'advisory' / undefined

對齊 charter §0.3：capacity 信號走 0-100 雷達；symptom 信號走 cutoffFlag 給 triage 用作 weighted rule（§4.2）。

### 3.4 Direction Semantics

`direction` 描述「raw value 與 capacity 的關係」：

| 案例 | direction | 理由 |
|---|---|---|
| vitality.sleep_quality（分越高 = 越好）| higher_is_better | raw 越高 → capacity 越好 |
| vitality.fatigue（分越高 = 越累）| higher_is_worse | raw 越高 → capacity 越差 |
| psychological.wellbeing (WHO-5) | higher_is_better | — |
| psychological.burnout (BAT-12) | higher_is_worse | — |
| cognition.processing_speed (RT ms) | higher_is_worse | ms 越多 → capacity 越差 |
| cognition.executive_function (TMT-A sec) | higher_is_worse | sec 越多 → capacity 越差 |

### 3.5 Domain 加權聚合（v4 inline 自含）

```ts
function scoreDomain(
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

  const capView = weighted.filter(x => x.style === 'capacity');
  const symView = weighted.filter(x => x.style === 'symptom');

  const computeView = (view: typeof weighted): number | undefined => {
    if (view.length === 0) return undefined;
    const w = view.reduce((s, x) => s + x.weight, 0);
    if (w === 0) return undefined;
    return Math.round(view.reduce((s, x) => s + x.score * x.weight, 0) / w);
  };

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
  return Object.keys(applicableWeights).filter(id => {
    const prefix = id.split('.')[0];
    return prefix === domain && !scoredIds.has(id);
  });
}
```

### 3.6 部分填答 / 缺漏的策略

| 狀況 | 策略 |
|---|---|
| Indicator 有 `minCompletionPolicy` | 用該 policy（WHO-5/BAT-12/PHQ-2/GAD-2/PSS-4 全 1.0）|
| Indicator N ≤ 4 無 policy | 預設 1.0 |
| Indicator N > 4 無 policy | 預設 ≥ 0.5 |
| reverseScored 題 | 套 `effective = maxScore - raw + minScore` 後計算 |
| Cutoff check | 對反向計分套用後的 rawSum 比較，僅完整作答時計算 |
| Domain 所有 indicator 都沒測 | scoreDomain 回 null |
| Domain weights 全為 0 | throw |
| Objective norm 為 null（dev placeholder）| dev mode skip；prod build 已被 validator 攔 |
| 65+ 使用者 | 仍照算，UI 顯示完整 advisory（§1.2）|

### 3.7 公開 API

```ts
export interface IndicatorScore {
  indicatorId: string;
  domain: ICDomain;
  style: IndicatorStyle;
  kind: IndicatorKind;
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

export interface SubScaleScore {
  subScaleId: string;
  score: number | null;
  subMean?: number;
  cutoffFlag?: boolean;
  cutoffSeverity?: 'consult' | 'advisory';
}

export interface DomainScore {
  domain: ICDomain;
  score: number;
  band: 'high' | 'moderate' | 'low';
  capacityScore?: number;
  symptomScore?: number;
  contributingIndicators: number;
  missingIndicators: string[];
}

export function scoreAssessment(input: {
  indicators: Indicator[];
  answers: Record<string, number>;
  objectiveResults: Record<string, number[]>;
  ageGroup: AgeGroupAdult;
}): {
  indicatorScores: IndicatorScore[];
  domainScores: DomainScore[];
  applicableWeights: Record<string, number>;       // ← v4 round 3 MJ-v3-1 修正：Map → Record
};

export function computeTriage(input: {
  indicatorScores: IndicatorScore[];
  domainScores: DomainScore[];
  applicableWeights: Record<string, number>;
  ageGroup: AgeGroupAdult;
  assessmentDate: string;
}): TriageResult;
```

---

## §4 分流邏輯 + 5 軸雷達 v1

> **對齊**: charter §0.2 修訂版 / §0.3 修訂版 / §0.4 修訂版 / §0.6 修訂版

### 4.1 分流判定順序

```
1. 若 ≥1 個 indicator/subscale cutoffSeverity === 'consult'
   → 'consult'（S1 內無此級實例，dead path 保留給未來）

2. 若 completedDomains < 3
   → 'incomplete'

3. 主規則（基於 band 與 advisory cutoff）：
   allHigh = 所有 domain band === 'high'
   moderateCount = band === 'moderate' 數
   lowCount = band === 'low' 數
   hasAdvisoryCutoff = ≥1 個 indicator/subscale cutoffSeverity === 'advisory'

   - allHigh && !hasAdvisoryCutoff               → 'normal'
   - allHigh && hasAdvisoryCutoff                → 'observe'
   - moderateCount === 1 && lowCount === 0       → 'observe'
   - moderateCount >= 2 || lowCount >= 1         → 'consult'
   - fallback                                    → 'observe'
```

### 4.2 Cutoff Severity 兩級

如 charter §0.3 修訂版。S1 內所有 indicator/subscale cutoff 都 `advisory`，第 1 條 dead path 保留。

### 4.3 Incomplete State

`completedDomains < 3 → incomplete`（unless ≥1 consult cutoff）。對齊 charter §0.1「健康評估」不給虛假確信。

### 4.4 Confidence

```ts
function computeConfidence(input: {
  category: TriageCategory;
  flaggedDomainCount: number;
  advisoryCutoffCount: number;
  completedDomains: number;
}): number {
  switch (input.category) {
    case 'incomplete':
      return Math.min(0.7, 0.3 + 0.1 * input.completedDomains);
    case 'normal':
      return Math.min(0.95, 0.7 + 0.05 * input.completedDomains);
    case 'observe':
      return Math.min(0.85, 0.6 + 0.05 * input.flaggedDomainCount + 0.05 * input.advisoryCutoffCount);
    case 'consult':
      return Math.min(0.95, 0.7 + 0.05 * input.flaggedDomainCount + 0.05 * input.advisoryCutoffCount);
  }
}
```

### 4.5 Recommendation 生成

```ts
export interface Recommendation {
  domain?: ICDomain;
  type: 'maintenance' | 'self-care' | 'in-depth-assessment' | 'consult-medical';
  message: string;
  suggestedSpecialties?: string[];
  triggerIndicators?: string[];
  evidenceFlags?: Array<'domain-low' | 'domain-moderate' | 'multi-domain-moderate' | 'clinical-cutoff'>;
}
```

**Domain × 觸發 → 建議科別**：

| Domain 觸發 | type | suggestedSpecialties |
|---|---|---|
| Vitality moderate | self-care | — |
| Vitality low | consult-medical | 家庭醫學科、營養師 |
| Locomotion moderate | self-care | — |
| Locomotion low | consult-medical | 復健科、家醫科 |
| Cognition moderate | in-depth-assessment | — |
| Cognition low | consult-medical | 神經內科、精神科 |
| Psychological moderate | self-care | — |
| Psychological low | consult-medical | 身心科、精神科、心理諮商 |
| PHQ-2 advisory cutoff | in-depth-assessment | 提示完成 PHQ-9（S2） |
| GAD-2 advisory cutoff | in-depth-assessment | 提示完成 GAD-7（S2） |
| PSS-4 advisory cutoff | in-depth-assessment | 提示完成 PSS-10（S2） |
| WHO-5 advisory cutoff | consult-medical | 身心科、精神科 |
| BAT-12 任 subscale red-zone | self-care + in-depth | 工作壓力管理資源（S3）|
| Sensory vision_impact | consult-medical | 眼科 |
| Sensory hearing_impact | consult-medical | 耳鼻喉科 |
| Sensory screen_fatigue | self-care | — |

### 4.6 雷達 v1 視覺指引 + Patient-facing copy

- 5 軸正上方順時針：vitality → locomotion → cognition → psychological → sensory
- 參考線：40 / 70
- 區段顏色用 design-tokens
- Untested domain：虛線 + 「未測」
- 病患點軸：drill-down indicator + sub-scale
- 觸控目標 ≥ 44px（CLAUDE.md）
- Patient-facing copy 約束見 charter §0.1 修訂版

### 4.7 TriageResult 完整型別

```ts
export type TriageCategory = 'normal' | 'observe' | 'consult' | 'incomplete';

export interface TriageResult {
  category: TriageCategory;
  confidence: number;
  summary: string;
  domainScores: DomainScore[];
  flaggedDomains: ICDomain[];
  clinicalCutoffs: Array<{
    indicatorId: string;
    subScaleId?: string;            // 若是 sub-scale cutoff（BAT-12）
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
```

### 4.8 RadarData

```ts
export interface RadarData {
  axes: Array<{
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
  }>;
  bandThresholds: { moderate: 40; high: 70 };
  meta: {
    triageCategory: TriageCategory;
    incomplete: boolean;
    completedDomains: number;
    totalDomains: 5;
    assessmentDate: string;
    ageGroup: AgeGroupAdult;
  };
}
```

### 4.9 FHIR Write-back Mapping

| TriageResult 欄位 | FHIR Resource |
|---|---|
| `domainScores[i].score` × 5 | `Observation` × 5（必）|
| `category` | `Observation`（必）|
| `clinicalCutoffs[i]` | `Observation`（必，若任一觸發；含 BAT-12 sub-scale red-zone）|
| `recommendations` | **不寫**（charter §0.4）|
| Provenance + Device | `Provenance` + `Device`（必，best-effort 含 401/403 fallback）|

具體於 §6。

### 4.10 Calibration plan

實作前用合成資料模擬：

| 元素 | Base rate |
|---|---|
| PHQ-2 ≥3 working-age | 5-8%（Kroenke 2003）|
| GAD-2 ≥3 working-age | 6-10%（Kroenke 2007）|
| Burnout BAT-12 至少 1 subscale red | ~17%（Eurofound 2022）|
| PSS-4 ≥9 high stress | ~15-20%（Warttig 2013 ≥ 80 percentile）|
| WHO-5 ≤13 raw | ~10-15%（Topp 2015）|

**目標**：consult < 20% / incomplete < 10% / normal ≥ 50%（charter §0.6）。
**fallback 規則變更需修 charter**（charter §0.7）。

---

## §5 兒科退場清單與影響

> **對齊**: charter §0.6 工程取向 · §0.1 命名

### 5.1 路徑命名

如 v3。

### 5.2 S1 範圍：3 層清單

- 🗑️ 刪：drawing/gross-motor/card-selector/assessment-analyzer/cdsa-triage/cdsa-radar-scoring（6 引擎）+ DrawingModule/GameModule/VideoModule/ChildProfile (重寫)（4 UI）+ drawing-classifier.onnx + cards/baselines/rules/questions.json（4 資料）
- ♻️ 重寫：behavior-analysis → objective-tests、voice-analysis git mv、age-groups 整檔、schemas 改 enum、scorer/triage/radar/recommendations/questionnaire 新建、PatientProfile、QuestionnaireModule、RadarChart
- ⏸️ S1 不動：voice-analysis (defer S2)、教育 MD (S3)、video-catalog (S3)、頁面 copy (S5)、cdsa-resources/cdsa-submit (S2)

### 5.3 完整 cross-reference list（v4 補 round 3 Engineering NC2 漏列）

#### 5.3a — Schema & Engine（Phase 3）

| # | File | 修法 |
|---|---|---|
| 1 | `src/lib/education/schemas.ts` | enum 改、cdss/SEVERITY/triggerEntrySchema discriminated union 重組 |
| 2 | `src/lib/db/schema.ts` | children → patients、childId → patientId、DB 名 smart-func-cds、Assessment.triageResult inline type、RecommendationCategory 改 4 類 |
| 3 | `src/lib/db/recommendations.ts` | enum cascade |
| 4 | `src/lib/utils/age-groups.ts` | 整檔重寫 |
| 5 | `src/lib/education/trigger-derivation.ts` | enum cascade |
| 6 | `src/lib/education/matrix-data.ts` | enum cascade |
| 7 | `src/lib/education/video-lookup.ts` | enum cascade |
| 8 | `src/lib/education/age-fallback.ts` | 兒科 7 段 → 成人 3 段 |
| 9 | `src/lib/fhir/cdsa-resources.ts` | TriageResult import 改 func/；code 格式改 IC |
| 10 | `src/lib/fhir/cdsa-submit.ts` | 同上 |
| 11 | `src/lib/fhir/assessment-fetch.ts` | SNOMED → category map 改 |
| 12 | `src/lib/stores/assessment.svelte.ts` | imports + state 結構改 |
| 13 | `scripts/build-questionnaire-applicability.ts` | prebuild script，hardcode 重寫 |
| 14 | **`scripts/curate/keywords.json`** | round 3 補：兒科 keywords driving curation |
| 15 | **`src/components/settings/NormsManager.svelte`** | round 3 補：`AgeGroupCDSA` import + hardcoded `'25-36m'` default |

#### 5.3b — UI Components（Phase 4）

| # | File | 修法 |
|---|---|---|
| 16 | `src/components/assess/AssessmentShell.svelte` | 模組陣列改 |
| 17 | `src/components/assess/ChildProfile.svelte` → `PatientProfile.svelte` | 重寫 |
| 18 | `src/components/assess/QuestionnaireModule.svelte` | enum cascade + objective tests 串接 |
| 19 | `src/components/assess/RadarChart.svelte` | 6 軸 → 5 軸 |
| 20 | `src/components/assess/ResultViewWrapper.svelte` | `ageGroupCDSA` 改 |
| 21 | `src/components/assess/AssessmentPdfReport.svelte` | `ageInMonths` → `ageInYears` |
| 22 | `src/components/assess/AssessmentHistory.svelte` | 兒科 age display |
| 23 | `src/components/assess/EducationMatch.svelte` | category enum |
| 24 | **`src/components/assess/ResultView.svelte`** | round 3 補：`monitor`/`refer` label/color、import `cdsa-submit` + `engine/cdsa/triage` |
| 25 | `src/components/patient/ResultDetail.svelte` | `ageGroupCDSA`、`childBirthDate` |
| 26 | `src/components/patient/ReportExport.svelte` | 'CDSS 兒科' 硬編字串 |
| 27 | `src/components/workspace/AssessmentsTab.svelte` | Category type + `childId` |
| 28 | `src/components/workspace/GuideTab.svelte` | 文案 |
| 29 | `src/components/settings/RecommendationsManager.svelte` | category enum |
| 30 | `src/pages/education/index.astro` | `CDSA_DOMAINS`/`AGE_GROUPS_CDSA` import cascade |

#### 5.3c — Data files

| # | File | 修法 |
|---|---|---|
| 31 | `src/data/education/content-relevance.yaml` | 74 條 cdsa.* trigger → Phase 3a minimal stub (5 IC × 2 band × 3 age ≈ 30 條空 articles)，schema 的 `severities` enum cascade 同步 |
| 32 | `src/data/cards/index.json` | 整檔刪 |
| 33 | `src/data/baselines/pediatric-baselines.json` | 整檔刪 |
| 34 | `src/data/rules/pediatric-default.yaml` | 整檔刪 |
| 35 | `src/data/questionnaire/questions.json` | 整檔刪，由 indicators.yaml 取代 |

#### 5.3d — Tests（round 3 補 15+ 漏列）

| 處理 | 檔案 |
|---|---|
| **整檔刪** | `tests/engine/{drawing-analysis,card-selector,assessment-analyzer}.test.ts`（兒科專屬，無對應成人 module）|
| **`git mv` + 重寫** | `tests/engine/behavior-analysis.test.ts` → `tests/engine/func/objective-tests.test.ts`（反應時間 + TMT-A 測試）|
| **`git mv` + 暫停** | `tests/engine/voice-analysis.test.ts` → `tests/engine/func/voice-analysis.test.ts`（S2 啟用）|
| **重寫 + 移位** | `tests/engine/radar-scoring.test.ts` → `tests/engine/func/radar-scoring.test.ts`（5 軸）|
| **重寫 + 移位** | `tests/engine/triage.test.ts` → `tests/engine/func/triage.test.ts`（4 類分流）|
| **內容檢查** | `tests/engine/closed-loop-education.test.ts`（若依賴兒科 enum 則改寫，否則保留 — 確認後再決）|
| **重寫** | `tests/components/{ChildProfile,RadarChart,ResultView,QuestionnaireModule}.test.ts` |
| **重寫** | `tests/components/education/{TriggerVideoList,VideoCard}.test.ts` |
| **重寫** | `tests/lib/db/{assessment-resolver,recommendations,recommendations-age}.test.ts` |
| **重寫** | `tests/lib/education/{merge-custom-videos,trigger-derivation,video-lookup,schemas}.test.ts` |
| **重寫** | `tests/lib/fhir/assessment-fetch.test.ts` |
| **重寫** | `tests/data/{questionnaire-coverage,education-no-video-fields}.test.ts` |
| **重寫** | `tests/utils/age-groups.test.ts` |
| **重寫** | `tests/design-system.test.ts`（domain band 色彩 token 改）|
| **`test.skip` until S3** | `tests/education/content-index-parity.test.ts`、`tests/data/education-slug-integrity.test.ts` |
| **`test.skip` until S5** | `tests/seo/schema.test.ts`、`tests/seo/positioning.test.ts` |

#### 5.3e — Branding / SEO（S5 defer）

如 v3：site.ts、site-faqs.ts、css 註解、verify-seo.mjs、9 個 .astro pages copy 都 defer。

### 5.4 IndexedDB 策略

```
全新專案，無舊 DB。
S1 直接用 'smart-func-cds' 為 DB 名 + Dexie v1 schema 一次定義成人模型。
無 migration code 需求。
```

### 5.5 Git history 保留策略

```bash
git mv src/engine/cdsa/behavior-analysis.ts src/engine/func/objective-tests.ts
git mv src/engine/cdsa/voice-analysis.ts src/engine/func/voice-analysis.ts
git mv src/components/assess/ChildProfile.svelte src/components/assess/PatientProfile.svelte
```

整資料夾刪除（如 `src/engine/cdsa/`）保留 git history。

### 5.6 退場執行順序

| Phase | 內容 |
|---|---|
| **Phase 0** | schemas.ts 新增 IC enum + funcTriageEntrySchema 共存 CDSA enum |
| **Phase 1** | 寫 src/engine/func/*.ts + 對應單元測試 |
| **Phase 2** | `git mv` 改寫檔案 |
| **Phase 3** | 改 schemas.ts 刪舊 enum + age-groups + prebuild script + curate/keywords.json |
| **Phase 3a** | content-relevance.yaml → minimal stub（5 IC × 2 band × 3 age ≈ 30 條）|
| **Phase 4** | 改 store + AssessmentShell + RadarChart + ResultView + workspace/patient/settings 元件 |
| **Phase 5** | 刪 cdsa/ 全資料夾 + cards/baselines/rules/onnx + ChildProfile.test 等 |
| **Phase 6** | 改 / skip 守門測試 |

每 Phase 結束 `pnpm check && pnpm lint && pnpm test` 全綠才進下一個。

---

## §6 FHIR 映射 + 測試策略

> **對齊**: charter §0.1 修訂版 / §0.2 / §0.4 修訂版（含 Device）/ §0.5 修訂版（LOINC + BAT 1-5）

### 6.1 FHIR Questionnaire

```yaml
resourceType: Questionnaire
url: https://yao-care.github.io/smart-func-cds/fhir/Questionnaire/ic-screen-v1
version: '1.0.0'
status: active
subjectType: [Patient]
title: 'IC-inspired Adult Functional Health Self-Assessment (Step 1)'
publisher: yao-care / smart-func-cds
derivedFrom:
  - 'http://loinc.org/q/55757-9'           # ← v4 round 3 FHIR C1 修正：LOINC canonical URL pattern
  - 'http://loinc.org/q/76342-5'           # PROMIS Fatigue 4a
copyright: 'Inspired by WHO IC framework concept...（依 charter §0.1 patient-facing copy 約束）'
item:
  - linkId: vitality
    text: 身體活力
    type: group
    item:
      - linkId: vitality.sleep_quality
        type: choice
        code:
          coding:
            - system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-indicator'
              code: vitality.sleep_quality
        answerOption:
          - { valueInteger: 0, extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/ordinalValue', valueDecimal: 0 }] }
          - { valueInteger: 1, extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/ordinalValue', valueDecimal: 1 }] }
          - { valueInteger: 2, extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/ordinalValue', valueDecimal: 2 }] }
          - { valueInteger: 3, extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/ordinalValue', valueDecimal: 3 }] }
      - linkId: vitality.fatigue           # PROMIS Fatigue 4a
        type: group
        code:
          coding:
            - system: 'http://loinc.org'
              code: '76342-5'              # ← v4 panel LOINC
        item: [ ... 4 questions ... ]
  - linkId: psychological
    type: group
    item:
      - linkId: psychological.wellbeing    # WHO-5（無 panel LOINC → local only）
        type: group
        code:
          coding:
            - system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-indicator'
              code: psychological.wellbeing
        item: [ ... 5 questions ... ]
      - linkId: psychological.depression   # PHQ-2 panel
        type: group
        code:
          coding:
            - system: 'http://loinc.org'
              code: '55757-9'              # PHQ-2 panel
        item:
          - linkId: psychological.depression.q1
            type: choice
            code:
              coding: [{ system: 'http://loinc.org', code: '44250-9' }]
          - linkId: psychological.depression.q2
            type: choice
            code:
              coding: [{ system: 'http://loinc.org', code: '44255-8' }]
      - linkId: psychological.anxiety      # GAD-2（無 panel LOINC，個別 item 用 GAD-7 q1-2 LOINC）
        type: group
        code:
          coding:
            - system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-indicator'
              code: psychological.anxiety
        # 註：GAD-2 在 LOINC 無專屬 panel；items 借用 GAD-7 前 2 題 LOINC 是 semantic-acceptable 折衷
        item:
          - linkId: psychological.anxiety.q1
            type: choice
            code: { coding: [{ system: 'http://loinc.org', code: '69725-0' }] }
          - linkId: psychological.anxiety.q2
            type: choice
            code: { coding: [{ system: 'http://loinc.org', code: '68509-9' }] }
      - linkId: psychological.burnout      # BAT-12
        type: group
        item: [ ... 12 questions ... ]
      - linkId: psychological.stress       # PSS-4
        type: group
        item: [ ... 4 questions ... ]
  - linkId: cognition
    type: group
    item:
      - linkId: cognition.processing_speed
        type: quantity
        extension:
          - url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit'
            valueCoding: { system: 'http://unitsofmeasure.org', code: 'ms', display: 'milliseconds' }
      - linkId: cognition.executive_function
        type: quantity
        extension:
          - url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit'
            valueCoding: { system: 'http://unitsofmeasure.org', code: 's', display: 'seconds' }
```

### 6.2 QuestionnaireResponse

```yaml
resourceType: QuestionnaireResponse
identifier:
  - { system: 'https://yao-care.github.io/smart-func-cds/fhir/identifier', value: '<assessment-uuid>' }
questionnaire: 'https://yao-care.github.io/smart-func-cds/fhir/Questionnaire/ic-screen-v1|1.0.0'
status: completed
subject: { reference: 'Patient/<id>', type: 'Patient' }
authored: '2026-05-28T14:23:00+08:00'
author: { reference: 'Patient/<id>', type: 'Patient' }
meta:
  profile: ['https://yao-care.github.io/smart-func-cds/fhir/StructureDefinition/IcQuestionnaireResponse']
item:
  - linkId: vitality.sleep_quality
    answer: [{ valueInteger: 2 }]
  - linkId: cognition.processing_speed
    answer:
      - valueQuantity: { value: 342, unit: 'ms', system: 'http://unitsofmeasure.org', code: 'ms' }
  - linkId: cognition.executive_function
    answer:
      - valueQuantity: { value: 28.5, unit: 's', system: 'http://unitsofmeasure.org', code: 's' }
```

### 6.3 Domain Observation × 5（v4 interpretation 合併 multi-coding）

```yaml
resourceType: Observation
identifier:
  - { system: 'https://yao-care.github.io/smart-func-cds/fhir/identifier', value: '<assessment-uuid>-psychological' }
status: final
category:
  - coding:
      - { system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: survey }
      - { system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: social-history }
code:
  coding:
    - { system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-domain-score', code: psychological, display: '心理功能分數' }
subject: { reference: 'Patient/<id>', type: 'Patient' }
effectiveDateTime: '2026-05-28T14:23:00+08:00'
performer: [{ reference: 'Patient/<id>', type: 'Patient' }]
note:
  - authorReference: { reference: 'Patient/<id>', type: 'Patient' }
    text: 'Self-reported via smart-func-cds v1.0.0'
valueQuantity:
  value: 65
  unit: score
  system: 'http://unitsofmeasure.org'
  code: '1'
interpretation:                            # ← v4 round 3 FHIR M1 修正：合併 multi-coding
  - coding:
      - { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A' }
      - { system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-domain-band', code: 'moderate' }
component:
  - code: { coding: [{ system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-score-component', code: capacity-score }] }
    valueQuantity: { value: 60, unit: score, system: 'http://unitsofmeasure.org', code: '1' }
  - code: { coding: [{ system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-score-component', code: symptom-score }] }
    valueQuantity: { value: 70, unit: score, system: 'http://unitsofmeasure.org', code: '1' }
  # BAT-12 4 sub-scale scores 用獨立 ic-subscale CodeSystem（v4 round 3 MJ-v3-2 修正）
  - code: { coding: [{ system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-subscale', code: 'bat12.exhaustion' }] }
    valueQuantity: { value: 45, unit: score, system: 'http://unitsofmeasure.org', code: '1' }
  - code: { coding: [{ system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-subscale', code: 'bat12.mental_distance' }] }
    valueQuantity: { value: 55, unit: score, system: 'http://unitsofmeasure.org', code: '1' }
  # ... bat12.cognitive_impairment / bat12.emotional_impairment
derivedFrom: [{ reference: 'urn:uuid:qr-001' }]
```

### 6.4 整體分流 Observation

```yaml
resourceType: Observation
identifier:
  - { system: 'https://yao-care.github.io/smart-func-cds/fhir/identifier', value: '<assessment-uuid>-triage' }
status: final
category:
  - coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: survey }]
code:
  coding:
    - { system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-triage-category', code: ic-triage-overall }
subject: { reference: 'Patient/<id>', type: 'Patient' }
effectiveDateTime: '2026-05-28T14:23:00+08:00'
valueCodeableConcept:
  coding:
    - { system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-triage-category', code: consult, display: '建議找醫師討論' }
hasMember:
  - { reference: 'urn:uuid:obs-vitality' }
  - { reference: 'urn:uuid:obs-locomotion' }
  - { reference: 'urn:uuid:obs-cognition' }
  - { reference: 'urn:uuid:obs-psychological' }
  - { reference: 'urn:uuid:obs-sensory' }
derivedFrom: [{ reference: 'urn:uuid:qr-001' }]
```

### 6.5 Clinical Cutoff Observation

```yaml
resourceType: Observation
identifier:
  - { system: 'https://yao-care.github.io/smart-func-cds/fhir/identifier', value: '<assessment-uuid>-cutoff-phq2' }
status: final
category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: survey }] }]
code:
  coding:
    - { system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-clinical-cutoff', code: positive-depression-screen }
subject: { reference: 'Patient/<id>', type: 'Patient' }
effectiveDateTime: '2026-05-28T14:23:00+08:00'
valueCodeableConcept:
  coding:
    - { system: 'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-cutoff-severity', code: advisory }
derivedFrom: [{ reference: 'urn:uuid:qr-001' }]
```

### 6.6 Provenance + Device（v4 SNOMED 英式拼字）

```yaml
# Device entry
resourceType: Device
identifier:
  - { system: 'https://yao-care.github.io/smart-func-cds/fhir/identifier', value: 'smart-func-cds@1.0.0' }
deviceName:
  - { name: 'smart-func-cds', type: 'model-name' }
version:
  - { value: '1.0.0' }
type:
  coding:
    - system: 'http://snomed.info/sct'
      code: '706689003'
      display: 'Application programme software'   # ← v4 round 3 FHIR M2 修正：英式拼字

# Provenance entry
resourceType: Provenance
target:
  - { reference: 'urn:uuid:qr-001' }
  - { reference: 'urn:uuid:obs-triage' }
occurredDateTime: '2026-05-28T14:23:00+08:00'   # 評估時間
recorded: '2026-05-28T14:24:30+08:00'            # 上傳時間
agent:
  - type:
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: author }]
    who: { reference: 'Patient/<id>', type: 'Patient' }
  - type:
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: assembler }]
    who: { reference: 'urn:uuid:device-smart-func-cds', type: 'Device' }
```

### 6.7 Local CodeSystem 完整定義（v4 統一 8 個）

```ts
// src/lib/fhir/code-systems.ts — 8 個 CodeSystem
export const IC_DOMAIN_SCORE_CS =        'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-domain-score';
export const IC_TRIAGE_CATEGORY_CS =     'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-triage-category';
export const IC_DOMAIN_BAND_CS =         'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-domain-band';
export const IC_INDICATOR_CS =           'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-indicator';
export const IC_SCORE_COMPONENT_CS =     'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-score-component';
export const IC_SUBSCALE_CS =            'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-subscale';
export const IC_CLINICAL_CUTOFF_CS =     'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-clinical-cutoff';
export const IC_CUTOFF_SEVERITY_CS =     'https://yao-care.github.io/smart-func-cds/fhir/CodeSystem/ic-cutoff-severity';
// 8 個常數對應 8 個 CodeSystem URL；其中 ic-indicator 的 concept 從 indicators.yaml schema-generated
```

> 註：v4 將 ic-subscale 從 ic-score-component 拆出（round 3 MJ-v3-2）。`ic-score-component` 純 generic（capacity-score / symptom-score）；`ic-subscale` 收 BAT-12 / 未來 WHO-5 / PHQ-9 / 等多向度量表 sub-scale。**實際 8 個 CodeSystem**。

#### CodeSystem JSON 完整 skeleton

```yaml
# ic-domain-score
concept:
  - { code: vitality, display: '身體活力分數', definition: 'IC vitality domain weighted-average score, 0-100' }
  - { code: locomotion, display: '行動功能分數', definition: '...' }
  - { code: cognition, display: '認知功能分數', definition: '...' }
  - { code: psychological, display: '心理功能分數', definition: '...' }
  - { code: sensory, display: '感官功能分數', definition: '...' }

# ic-triage-category
concept:
  - { code: ic-triage-overall, display: '整體分流結論觀察項', definition: 'Observation .code for overall triage' }
  - { code: normal, display: '正常', definition: 'All domain band high, no advisory cutoff' }
  - { code: observe, display: '建議觀察', definition: '1 moderate band OR all-high+advisory cutoff OR 1 moderate+advisory cutoff' }
  - { code: consult, display: '建議找醫師討論', definition: '≥1 low OR ≥2 moderate OR ≥1 consult-severity cutoff' }
  - { code: incomplete, display: '評估未完成', definition: 'Fewer than 3 domains completed' }

# ic-domain-band
concept:
  - { code: high, display: '良好', definition: 'Domain score ≥ 70' }
  - { code: moderate, display: '中等', definition: 'Domain score 40-69' }
  - { code: low, display: '偏低', definition: 'Domain score < 40' }

# ic-score-component (純 generic)
concept:
  - { code: capacity-score, display: '能力分數', definition: 'Weighted average of capacity-style indicators only' }
  - { code: symptom-score, display: '症狀分數', definition: 'Weighted average of symptom-style indicators only' }

# ic-subscale (v4 拆出，instrument-specific sub-scale)
concept:
  - { code: 'bat12.exhaustion', display: 'BAT-12 精疲力竭', definition: 'BAT-12 exhaustion subscale 0-100' }
  - { code: 'bat12.mental_distance', display: 'BAT-12 心理疏離', definition: '...' }
  - { code: 'bat12.cognitive_impairment', display: 'BAT-12 認知失能', definition: '...' }
  - { code: 'bat12.emotional_impairment', display: 'BAT-12 情緒失調', definition: '...' }
  # 未來：'phq9.cluster_*', 'who5.*' 等 hierarchical naming

# ic-clinical-cutoff
concept:
  - { code: positive-depression-screen, display: 'PHQ-2 ≥3', definition: 'PHQ-2 raw sum ≥ 3' }
  - { code: positive-anxiety-screen, display: 'GAD-2 ≥3', definition: 'GAD-2 raw sum ≥ 3' }
  - { code: positive-stress-screen, display: 'PSS-4 ≥9', definition: 'PSS-4 raw sum ≥ 9' }
  - { code: low-wellbeing-screen, display: 'WHO-5 ≤13', definition: 'WHO-5 raw sum ≤ 13' }
  - { code: bat12-exhaustion-redzone, display: 'BAT-12 exhaustion ≥2.96', definition: '...' }
  - { code: bat12-mental-distance-redzone, display: 'BAT-12 mental distance ≥2.81', definition: '...' }
  - { code: bat12-cognitive-impairment-redzone, display: 'BAT-12 cognitive ≥2.41', definition: '...' }
  - { code: bat12-emotional-impairment-redzone, display: 'BAT-12 emotional ≥2.61', definition: '...' }

# ic-cutoff-severity
concept:
  - { code: consult, display: '直升 consult', definition: 'Escalates triage to consult immediately' }
  - { code: advisory, display: '提示 observe + S2', definition: 'Suggests deeper assessment but does not directly escalate to consult' }

# ic-indicator (schema-generated from indicators.yaml)
concept:
  - { code: 'vitality.sleep_quality', display: '睡眠品質' }
  # ... 全部 indicator IDs 自動生成
```

GitHub Pages 直接 serve `application/json`（多數 validator 接受；嚴格 IG Publisher 需自訂 Content-Type，待 S5 Cloudflare migration 解）。

### 6.8 寫回 Bundle 結構（v4 完整含 Device 與 ifNoneExist）

```yaml
resourceType: Bundle
type: transaction
entry:
  - fullUrl: 'urn:uuid:device-smart-func-cds'
    request:
      method: POST
      url: Device
      ifNoneExist: 'identifier=https://yao-care.github.io/smart-func-cds/fhir/identifier|smart-func-cds@1.0.0'
    resource: { ...Device... }
  - fullUrl: 'urn:uuid:qr-001'
    request:
      method: POST
      url: QuestionnaireResponse
      ifNoneExist: 'identifier=https://yao-care.github.io/smart-func-cds/fhir/identifier|<assessment-uuid>'
    resource: { ...QR... }
  # 5 domain Observations
  - fullUrl: 'urn:uuid:obs-vitality'
    request: { method: POST, url: Observation, ifNoneExist: 'identifier=...|<assessment-uuid>-vitality' }
    resource: { ...Obs..., derivedFrom: [{ reference: 'urn:uuid:qr-001' }] }
  # ... 4 more domain Observations
  - fullUrl: 'urn:uuid:obs-triage'
    request: { method: POST, url: Observation, ifNoneExist: 'identifier=...|<assessment-uuid>-triage' }
    resource: { ...triage Obs with hasMember + derivedFrom... }
  # cutoff Observations (若觸發)
  - fullUrl: 'urn:uuid:cutoff-phq2'
    request: { method: POST, url: Observation, ifNoneExist: 'identifier=...|<assessment-uuid>-cutoff-phq2' }
    resource: { ...cutoff Obs... }
  - fullUrl: 'urn:uuid:provenance-001'
    request: { method: POST, url: Provenance }
    resource: { ...Provenance with Device reference... }
```

**Atomicity**: transaction Bundle，retry with exponential backoff；sequential fallback defer S2。

**Provenance.c 失敗處理**：若 server 拒絕該 scope 或 Bundle entry 返回 401/403，重組 Bundle **不含 Device + Provenance entries** 再 POST。在 `fhir-writer.ts` 偵測 Bundle.response.outcome 後降級。

### 6.9 Profile（StructureDefinition）— defer

S1 不發 Profile，但 `meta.profile` 預留 placeholder（forward-compat to S5 IG）。

### 6.10 測試策略

#### Unit Tests

| 檔案 | 覆蓋 |
|---|---|
| `tests/engine/func/scorer.test.ts` | direction、reverseScored 邏輯、cutoff 用實答 raw、subScale + sub-cutoff、minCompletionPolicy override、totalWeight=0 throw、z-clamp、norm null dev mode、**BAT-12 1-5 Likert 公式驗算**（全 1→100、全 5→0、mid 3→50）|
| `tests/engine/func/triage.test.ts` | 4 類分流；判定順序；advisory cutoff 不升 consult；evidenceFlags |
| `tests/engine/func/radar-scoring.test.ts` | 5 軸；未測 domain；band 邊界（39/40/69/70）|
| `tests/engine/func/objective-tests.test.ts` | reaction-time median + valid range；TMT-A 計時 |
| `tests/engine/func/questionnaire.test.ts` | union 完整性、license enforce、INDICATOR_KINDS / STYLES / DIRECTION_KINDS exhaustive、subScale ids ⊆ questions ids、id-domain prefix consistency、norm null in dev allow / prod reject |

Parameterised test 規模 < 1500 cases / runtime < 10s。

#### Build-time Guardrails

```ts
// scripts/validate-indicators.ts (prebuild)
// 1. license ∈ LICENSE_KINDS，拒絕 'commercial' 或缺失
// 2. kind ∈ INDICATOR_KINDS；style ∈ INDICATOR_STYLES；direction ∈ DIRECTION_KINDS
// 3. indicator.id 符合 /^<domain>\..+$/，domain prefix 與 indicator.domain 一致
// 4. 5 個 IC domain 都至少有 1 個 indicator + 至少 1 個 capacity-style indicator
// 5. ObjectiveTest.norms 每個 AgeGroupAdult key 存在；prod build 拒絕 null
// 6. ClinicalCutoff.severity ∈ {consult, advisory} + citation 必填
// 7. ObjectiveTest.norms[*].std > 0 且 > |mean| * 0.01
// 8. subScales[*].questionIds ⊆ questions[*].id 集合
// 9. LikertQuestion.options[*].score 在 [minScore, maxScore] 範圍
// 10. maxScore - minScore > 0; maxScore ≤ 10 sane bound
// 11. LikertQuestion.loincCode 為 valid LOINC format（'\d{1,5}-\d' regex）若存在
```

#### prebuild chain

```bash
prebuild: tsx scripts/build-content-index.ts \
       && tsx scripts/validate-indicators.ts \
       && tsx scripts/build-questionnaire-applicability.ts
```

#### Integration Tests

| 檔案 | 覆蓋 |
|---|---|
| `tests/engine/func/end-to-end-scoring.test.ts` | indicators → answers → IndicatorScore → DomainScore → TriageResult 全流程 |
| `tests/lib/fhir/func-submit.test.ts` | TriageResult → Bundle（QR + 5 Obs + triage + cutoff + Device + Provenance），urn:uuid: refs，Provenance fallback |

#### Deferred / Skipped 守門

如 §5.3d。

#### E2E

S1 smoke：填完 1 個完整 domain + 1 互動測試 → 看到 incomplete 結果頁 + radar drill-down。完整 50 題 E2E defer S5。

#### 覆蓋率目標

| 模組 | 目標 |
|---|---|
| `src/engine/func/*.ts` | 100% |
| `src/lib/fhir/func-submit.ts` | 90%+ |
| `src/lib/utils/age-groups.ts` | 100% |

### 6.11 效能 / 規模

13-17 分；scorer <50ms；不入 Worker。FHIR submit async。IndexedDB ~55 answers + 1 assessment record <100ms。

---

## §7 議定參數總表

> **對齊**: charter §0.6 修訂版

| 維度 | 鎖定值 |
|---|---|
| 族群 | 18-64 working-age（charter §0.6）|
| 分齡 | 18-39 / 40-54 / 55-64 |
| 資料來源 | Likert + cognition 互動測試（RT + TMT-A）|
| 領域 | 5 軸 vitality/locomotion/cognition/psychological/sensory |
| 順序 | 正上方順時針 |
| Likert 解析度 | 混用 0-3 / 0-4 / 1-5 / 0-5；maxScore + minScore?；歸一 `(sum - N*minScore)/(N*range)`；reverseScored 支援 |
| 計分原則 | direction-aware；N≤4 100% 或 minCompletionPolicy override；cutoff 對實答 raw；z-clamp ±4 |
| Direction 語意 | raw value 對 capacity 的關係；統一在 BaseIndicator |
| Domain band | high ≥ 70 / moderate 40-69 / low < 40 |
| Triage category | normal / observe / consult / incomplete |
| Triage 判定順序 | consult cutoff → incomplete → 主規則 |
| Cutoff severity | consult / advisory（S1 全 advisory）|
| Calibration 目標 | consult < 20% / incomplete < 10% / normal ≥ 50% |
| Primary user | 病患自評 |
| FHIR launch | SMART App Launch 2.0 Standalone |
| FHIR write-back | QR + 5 Obs (domain) + 1 Obs (triage) + 0..n Obs (cutoff) + Device + Provenance |
| Bundle 模式 | transaction with urn:uuid: + ifNoneExist `system\|value` |
| Burnout | BAT-12（cc-by-nc-sa）+ 4 sub-scale × 3 題 **1-5 Likert** + minCompletionPolicy 1.0 + **4 個 subscale advisory cutoffs**（exhaustion ≥2.96 / mental_distance ≥2.81 / cognitive ≥2.41 / emotional ≥2.61）|
| Wellbeing | WHO-5（cc-by-nc-sa）**無 LOINC** + minCompletionPolicy 1.0 + advisory cutoff @ raw ≤13 |
| Depression 篩 | PHQ-2（public-domain，LOINC panel **55757-9**，items 44250-9 / 44255-8，total 55758-7）+ advisory cutoff ≥3 |
| Anxiety 篩 | GAD-2（public-domain，**無 panel LOINC**，items 69725-0 / 68509-9）+ advisory cutoff ≥3 |
| Stress 篩 | PSS-4（research-open-noncommercial）+ q2/q3 reverseScored + advisory cutoff ≥9 |
| Fatigue（vitality）| PROMIS Fatigue 4a（cc-by-nc-sa，**LOINC 76342-5**）|
| Cognition objective | reaction-time(simple-visual, 20+5, 100-2000ms, median, age-stratified norms TBD)、TMT-A(25, browser-mouse, age-stratified TBD) |
| Sensory capacity | sensory.functional_acuity（study-developed；S2/S3 可改 HHIE-S）|
| MBI | 排除 |
| 評估哲學 | Capacity + Symptom 混用；每 domain ≥ 1 capacity |
| 工程取向 | 鎖頭就拔 |
| DB 名 | smart-func-cds |
| Trigger prefix | func. |
| 模組路徑 | src/engine/func/ |
| Patient-facing copy | 禁用 "WHO-validated"；用 "Inspired by WHO IC concept" |
| Local CodeSystem | **8 個**（domain-score、triage-category、domain-band、indicator、score-component、subscale、clinical-cutoff、cutoff-severity）|
| FHIR Profile | S1 不發；meta.profile placeholder |

---

## §8 Open questions

> **對齊**: charter §0.7

1. **Likert 題目具體 zh-Hant 題幹** — implementation phase 撰寫 + 臨床審。
2. **反應時間 / TMT-A 成人分齡常模** — 候選來源 NIH Toolbox / MindCrowd / Talboom 2020 / Tombaugh 2004。Prod build 前必須填。
3. **GAD-2 / WHO-5 panel LOINC** — 持續查；BAT-12 / PSS-4 暫無 panel LOINC，用 local。
4. **Calibration plan 合成資料模擬** — base rates 見 §4.10。consult >20% 即改規則。
5. **GitHub Pages serving FHIR JSON content-type** — S5 Cloudflare migration。
6. **SMART scope 實測** — Epic / Cerner / 台灣本土 EHR 對 patient-facing standalone + `patient/Provenance.c` 支援度（S2）。
7. **FHIR Profile / IG publishing** — S2 或 S5。
8. **`incomplete` 是否寫 FHIR** — 預設寫，實測後可移除。
9. **PHQ-2 / GAD-2 raw 強度分級** — advisory cutoff 升 observe 可能 false-negative。S2 可加 raw ≥5 直升 consult。charter §0.3 已預留 severity enum 擴展性。
10. **transaction sequential fallback** — S1 不實作，S2 視實測再加。
11. **sensory.functional_acuity** — 自製 indicator。S2/S3 評估改用 HHIE-S（hearing 10 題 public-domain）+ 獨立 vision 自陳。
14. **BAT-12 4 個 subscale cutoff 數值二次驗證** — exhaustion 2.96 / mental_distance 2.81 / cognitive 2.41 / emotional 2.61 引自 Schaufeli 2020 BAT manual + De Beer 2020 short-form validation；research doc 未獨立背書，implementation 前需對照最新 BAT manual 修訂版（KU Leuven 官方）確認。
12. **Map vs Record 序列化** — v4 全改 Record，Worker / IndexedDB 友善。
13. **ifNoneExist 跨 server 支援度** — Epic / HAPI / Cerner 行為差異，S2 實測。

---

## §9 SMART Launch 細部

> **對齊**: charter §0.1 / §0.2

### 9.1 SMART App Launch 2.0（PKCE 必須）

### 9.2 Scopes

```
launch/patient
openid fhirUser
patient/Patient.r
patient/QuestionnaireResponse.c
patient/Observation.c
patient/Device.c                  # Device 寫入需此 scope（許多 EHR 不認，best-effort）
patient/Provenance.c              # best-effort
```

**Device / Provenance 失敗處理**：若 server 拒此 scope 或 entry 返回 401/403，重組 Bundle 移除 Device + Provenance entry 再 POST；log warning 但不 fail user flow。

### 9.3 Endpoint Discovery

`.well-known/smart-configuration`。

### 9.4 前置條件

病患必須先在 EHR patient portal 註冊登入。

### 9.5 PKCE + State

code_challenge_method = S256；state + nonce 各 128 bits。

### 9.6 Token 儲存

IndexedDB（不存 localStorage）。

---

## §10 變更紀錄

> **對齊**: charter §0.8

| 日期 | 修改 | 說明 |
|---|---|---|
| 2026-05-28 | v1 | brainstorming session 議定 |
| 2026-05-28 | v1 → v2 | 整批修 round 1 (17 critical + 26 major) |
| 2026-05-28 | v2 → v3 | 整批修 round 2 (12 critical + 27 major) |
| 2026-05-28 | v3 → v4 | 整批修 round 3 (7 critical + 23 major)：BAT-12 公式 critical 修正、PSS-4 cutoff、WHO-5/BAT-12 minCompletionPolicy、LOINC URL pattern、PROMIS Fatigue 4a LOINC `76342-5`、§5.3 補 8+ files、interpretation cardinality、SNOMED 英式拼字、8 個 CodeSystem 統一、Map → Record、LikertQuestion.loincCode、sensory functional_acuity license 修正 + HHIE-S 替代列管、§3/§4/§5 全 inline 自含。同步修 charter §0.1 / §0.4 / §0.6 / §0.8（1 個合併 changelog entry）|
