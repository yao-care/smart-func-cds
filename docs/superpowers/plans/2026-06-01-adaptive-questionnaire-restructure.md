# 自適應分層問卷重構 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 41 題問卷重構為「方案 C 精簡 + 動態分層調配」——先問 11 題螢檢，分數顯示問題才追問詳細題；移除 BAT-12 與 screen_fatigue；PHQ-2/GAD-2 篩陽即就地展開 PHQ-9/GAD-7，PHQ-9 第 9 題勾選即顯示危機資源。

**Architecture:** 在 indicator schema 加兩種分層標記（指標層 `tier`、題層 `tier` + `revealDetailWhen`）。計分仍在引擎端 `scorer.ts`，新增 `isDetailRevealed()` 並改寫 `scoreLikertIndicator` 採「自適應完成度」（未觸發的 detail 題不計入分母，clinicalCutoff 一律在 screener 題上評估）。UI `QuestionnaireModule.svelte` 改為「答案驅動、按域展開」：`visibleQuestions` 由 `answers` 反應式推導，detail 題/指標依觸發條件揭露。新增 `CrisisResources.svelte`。

**Tech Stack:** Astro 5 SSG、Svelte 5 runes、Zod（astro/zod）、js-yaml、Vitest、Playwright、CSS OKLCH tokens。

設計來源：`docs/superpowers/specs/2026-06-01-adaptive-questionnaire-restructure-design.md`

---

## 檔案結構

| 檔案 | 動作 | 職責 |
|---|---|---|
| `src/engine/func/questionnaire.ts` | 修改 | schema 加 `tier`（指標層+題層）、`revealDetailWhen`；匯出型別 |
| `src/engine/func/scorer.ts` | 修改 | 新增 `isDetailRevealed()`；改寫 `scoreLikertIndicator()` 自適應完成度 |
| `src/data/questionnaire/indicators.yaml` | 修改 | 全面重構：移除 BAT-12/screen_fatigue/appetite/weight_stability；新增 nutrition/cognitive_self_report 螢檢；depression→PHQ-9、anxiety→GAD-7；標 tier |
| `scripts/validate-indicators.ts` | 修改 | 加 tier 守門（detail 不可孤兒、revealDetailWhen 題必須存在且為 screener） |
| `src/engine/func/recommendations.ts` | 修改 | 刪 burnout/screen_fatigue 分支；更新 depression/anxiety 文案（已完成 PHQ-9/GAD-7） |
| `src/components/assess/CrisisResources.svelte` | 新增 | 危機求助資源元件（台灣 1925/1995/119） |
| `src/components/assess/QuestionnaireModule.svelte` | 修改 | 答案驅動、按域展開的自適應流程；q9 觸發危機元件 |
| `src/components/assess/ResultView.svelte` | 修改 | 若 PHQ-9 q9>0 於結果頁再顯示危機元件 |
| `tests/engine/func/scorer.test.ts` | 修改 | 自適應完成度、cutoff-on-screener、isDetailRevealed |
| `tests/engine/func/recommendations.test.ts` | 修改 | 移除 burnout/screen_fatigue 斷言 |
| `tests/components/QuestionnaireModule.test.ts` | 修改 | 螢檢-only 可見題數、展開行為 |
| `tests/e2e/assess-flow.spec.ts` | 修改 | 健康 11 題即結束、篩陽展開、q9 危機 |

---

## Phase 1：Schema 與內容

### Task 1：schema 加分層欄位

**Files:**
- Modify: `src/engine/func/questionnaire.ts`
- Test: `tests/engine/func/questionnaire.test.ts`

- [ ] **Step 1: 先寫失敗測試**

在 `tests/engine/func/questionnaire.test.ts` 末尾加：

```ts
import { describe, it, expect } from 'vitest';
import { indicatorSchema } from '../../../src/engine/func/questionnaire';

describe('tier 分層欄位', () => {
  it('指標層 tier 預設為 screener', () => {
    const parsed = indicatorSchema.parse({
      kind: 'likert', id: 'vitality.sleep_quality', domain: 'vitality',
      label: '睡眠', style: 'capacity', direction: 'higher_is_better',
      maxScore: 3, weight: 1.0, license: 'public-domain',
      questions: [{ id: 'vitality.sleep_quality.q1', text: 'x',
        options: [{ label: 'a', score: 0 }, { label: 'b', score: 3 }] }],
    });
    expect(parsed.kind === 'likert' && parsed.tier).toBe('screener');
  });

  it('題層 tier:detail 與 revealDetailWhen 可被解析', () => {
    const parsed = indicatorSchema.parse({
      kind: 'likert', id: 'vitality.fatigue', domain: 'vitality',
      label: '疲勞', style: 'symptom', direction: 'higher_is_worse',
      maxScore: 4, weight: 1.0, license: 'cc-by-nc-sa',
      revealDetailWhen: { screenerQuestionIds: ['vitality.fatigue.q1'], threshold: 2, comparator: '>=' },
      questions: [
        { id: 'vitality.fatigue.q1', text: 'x', options: [{ label: 'a', score: 0 }, { label: 'b', score: 4 }] },
        { id: 'vitality.fatigue.q2', text: 'y', tier: 'detail', options: [{ label: 'a', score: 0 }, { label: 'b', score: 4 }] },
      ],
    });
    expect(parsed.kind === 'likert' && parsed.questions[1].tier).toBe('detail');
    expect(parsed.kind === 'likert' && parsed.revealDetailWhen?.threshold).toBe(2);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/engine/func/questionnaire.test.ts -t tier`
Expected: FAIL（`tier`/`revealDetailWhen` 尚未存在，`parsed.tier` 為 undefined）

- [ ] **Step 3: 實作 schema 變更**

在 `src/engine/func/questionnaire.ts`：

3a. `likertQuestionSchema`（第 22-31 行）加 `tier`：

```ts
export const likertQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  reverseScored: z.boolean().optional(),
  tier: z.enum(['screener', 'detail']).optional(),
  loincCode: z.string().regex(loincRegex).nullable().optional(),
  options: z.array(z.object({
    label: z.string(),
    score: z.number(),
  })),
});
```

3b. 在 `clinicalCutoffSchema`（第 39 行後）新增 reveal 條件 schema：

```ts
export const revealDetailWhenSchema = z.object({
  screenerQuestionIds: z.array(z.string()).min(1),
  threshold: z.number(),
  comparator: z.enum(['>=', '<=']),
});
```

3c. `baseIndicatorFields`（第 49-59 行）加 `tier`（預設 screener）：

```ts
const baseIndicatorFields = {
  id: z.string().regex(/^[a-z_]+\.[a-z_]+$/, 'id must be <domain>.<name>'),
  domain: z.enum(IC_DOMAIN_NAMES),
  label: z.string().min(1),
  tier: z.enum(['screener', 'detail']).default('screener'),
  style: z.enum(INDICATOR_STYLES),
  direction: z.enum(DIRECTION_KINDS),
  weight: z.number().nonnegative(),
  ageApplicability: z.array(z.enum(AGE_GROUPS_ADULT)).optional(),
  license: z.enum(LICENSE_KINDS).refine(l => l !== 'commercial', { message: 'commercial license forbidden' }),
  loincCode: z.string().regex(loincRegex).nullable().optional(),
};
```

3d. `likertIndicatorSchema`（第 61-70 行）加 `revealDetailWhen`：

```ts
export const likertIndicatorSchema = z.object({
  kind: z.literal('likert'),
  ...baseIndicatorFields,
  maxScore: z.number().int().positive().max(10),
  minScore: z.number().int().nonnegative().optional(),
  questions: z.array(likertQuestionSchema).min(1),
  subScales: z.array(likertSubScaleSchema).optional(),
  clinicalCutoff: clinicalCutoffSchema.optional(),
  revealDetailWhen: revealDetailWhenSchema.optional(),
  minCompletionPolicy: z.number().min(0).max(1).optional(),
}).refine(d => d.maxScore > (d.minScore ?? 0), { message: 'maxScore must > minScore' });
```

3e. 型別匯出（第 113-120 行附近）加：

```ts
export type RevealDetailWhen = z.infer<typeof revealDetailWhenSchema>;
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm vitest run tests/engine/func/questionnaire.test.ts -t tier`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/func/questionnaire.ts tests/engine/func/questionnaire.test.ts
git commit -m "feat(func): indicator schema 加 tier 分層與 revealDetailWhen"
```

---

### Task 2：scorer 新增 isDetailRevealed 共用判定

**Files:**
- Modify: `src/engine/func/scorer.ts`
- Test: `tests/engine/func/scorer.test.ts`

- [ ] **Step 1: 先寫失敗測試**

在 `tests/engine/func/scorer.test.ts` 末尾加：

```ts
import { isDetailRevealed } from '../../../src/engine/func/scorer';
import type { LikertIndicator } from '../../../src/engine/func/questionnaire';

const fatigueLike: LikertIndicator = {
  kind: 'likert', id: 'vitality.fatigue', domain: 'vitality', label: '疲勞',
  tier: 'screener', style: 'symptom', direction: 'higher_is_worse',
  maxScore: 4, weight: 1.0, license: 'cc-by-nc-sa',
  revealDetailWhen: { screenerQuestionIds: ['vitality.fatigue.q1'], threshold: 2, comparator: '>=' },
  questions: [
    { id: 'vitality.fatigue.q1', text: 'x', options: [{ label: 'a', score: 0 }, { label: 'b', score: 4 }] },
    { id: 'vitality.fatigue.q2', text: 'y', tier: 'detail', options: [{ label: 'a', score: 0 }, { label: 'b', score: 4 }] },
  ],
};

describe('isDetailRevealed', () => {
  it('螢檢題未達門檻 → 不揭露', () => {
    expect(isDetailRevealed(fatigueLike, { 'vitality.fatigue.q1': 1 })).toBe(false);
  });
  it('螢檢題達門檻 → 揭露', () => {
    expect(isDetailRevealed(fatigueLike, { 'vitality.fatigue.q1': 2 })).toBe(true);
  });
  it('螢檢題未作答 → 不揭露', () => {
    expect(isDetailRevealed(fatigueLike, {})).toBe(false);
  });
  it('無 revealDetailWhen → 不揭露', () => {
    expect(isDetailRevealed({ ...fatigueLike, revealDetailWhen: undefined }, { 'vitality.fatigue.q1': 4 })).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/engine/func/scorer.test.ts -t isDetailRevealed`
Expected: FAIL（`isDetailRevealed` is not a function）

- [ ] **Step 3: 實作 isDetailRevealed**

在 `src/engine/func/scorer.ts` 的 import 之後、`scoreLikertIndicator` 之前插入：

```ts
/**
 * 判斷某指標的「題層 detail」是否該被揭露：
 * 取 revealDetailWhen.screenerQuestionIds 的有效（reverse 校正後）分數加總，
 * 全部螢檢題都作答且符合 threshold/comparator 才回 true。
 */
export function isDetailRevealed(
  indicator: LikertIndicator,
  answers: Record<string, number>,
): boolean {
  const cond = indicator.revealDetailWhen;
  if (!cond) return false;
  const minScore = indicator.minScore ?? 0;
  const maxScore = indicator.maxScore;
  const qById = new Map(indicator.questions.map(q => [q.id, q]));
  let sum = 0;
  for (const qid of cond.screenerQuestionIds) {
    const q = qById.get(qid);
    const raw = answers[qid];
    if (!q || !Number.isFinite(raw)) return false;
    sum += (q.reverseScored ?? false) ? reverseScoreOf(raw, maxScore, minScore) : raw;
  }
  return cond.comparator === '>=' ? sum >= cond.threshold : sum <= cond.threshold;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm vitest run tests/engine/func/scorer.test.ts -t isDetailRevealed`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/func/scorer.ts tests/engine/func/scorer.test.ts
git commit -m "feat(func): scorer 新增 isDetailRevealed 共用判定"
```

---

### Task 3：scoreLikertIndicator 自適應完成度

**Files:**
- Modify: `src/engine/func/scorer.ts:45-144`
- Test: `tests/engine/func/scorer.test.ts`

- [ ] **Step 1: 先寫失敗測試**

在 `tests/engine/func/scorer.test.ts` 末尾加（沿用 Task 2 的 `fatigueLike`，並加一個含 cutoff 的 PHQ-9-like 指標）：

```ts
import { scoreLikertIndicator } from '../../../src/engine/func/scorer';

const phq9Like: LikertIndicator = {
  kind: 'likert', id: 'psychological.depression', domain: 'psychological', label: 'PHQ-9',
  tier: 'screener', style: 'symptom', direction: 'higher_is_worse',
  maxScore: 3, weight: 1.0, license: 'public-domain', minCompletionPolicy: 1.0,
  clinicalCutoff: { threshold: 3, comparator: '>=', flagLabel: 'positive-depression-screen', severity: 'advisory', citation: 'Kroenke 2003' },
  revealDetailWhen: { screenerQuestionIds: ['psychological.depression.q1', 'psychological.depression.q2'], threshold: 3, comparator: '>=' },
  questions: [
    { id: 'psychological.depression.q1', text: 'a', options: [{ label: '從不', score: 0 }, { label: '幾乎每天', score: 3 }] },
    { id: 'psychological.depression.q2', text: 'b', options: [{ label: '從不', score: 0 }, { label: '幾乎每天', score: 3 }] },
    { id: 'psychological.depression.q3', text: 'c', tier: 'detail', options: [{ label: '從不', score: 0 }, { label: '幾乎每天', score: 3 }] },
  ],
};

describe('scoreLikertIndicator 自適應完成度', () => {
  it('detail 未觸發：只用螢檢題計分，不因 detail 未答而回 null', () => {
    const s = scoreLikertIndicator(phq9Like, {
      'psychological.depression.q1': 0, 'psychological.depression.q2': 0,
    });
    expect(s).not.toBeNull();
    expect(s!.questionsTotal).toBe(2);
    expect(s!.questionsAnswered).toBe(2);
  });

  it('clinicalCutoff 在螢檢題（PHQ-2）上評估：q1+q2>=3 即 flag', () => {
    const s = scoreLikertIndicator(phq9Like, {
      'psychological.depression.q1': 2, 'psychological.depression.q2': 1,
    });
    expect(s!.cutoffFlag).toBe(true);
    expect(s!.cutoffFlagLabel).toBe('positive-depression-screen');
  });

  it('detail 觸發但未答完：要求全 9 題（policy 1.0）→ 回 null', () => {
    const s = scoreLikertIndicator(phq9Like, {
      'psychological.depression.q1': 2, 'psychological.depression.q2': 2,
    });
    expect(s).toBeNull();
  });

  it('detail 觸發且答完：用全部題計分', () => {
    const s = scoreLikertIndicator(phq9Like, {
      'psychological.depression.q1': 2, 'psychological.depression.q2': 2, 'psychological.depression.q3': 3,
    });
    expect(s).not.toBeNull();
    expect(s!.questionsTotal).toBe(3);
  });

  it('fatigue：detail 未觸發只算 q1（symptom，minCompletionPolicy 預設 1.0 over N=1）', () => {
    const s = scoreLikertIndicator(fatigueLike, { 'vitality.fatigue.q1': 1 });
    expect(s).not.toBeNull();
    expect(s!.questionsTotal).toBe(1);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/engine/func/scorer.test.ts -t "自適應完成度"`
Expected: FAIL（目前 `scoreLikertIndicator` 以全部 questions 為 N，PHQ-9-like 的 detail 未答會因 minCompletionPolicy 回 null）

- [ ] **Step 3: 改寫 scoreLikertIndicator**

將 `src/engine/func/scorer.ts` 第 45-144 行整個函式替換為：

```ts
export function scoreLikertIndicator(
  indicator: LikertIndicator,
  answers: Record<string, number>,
): IndicatorScore | null {
  const minScore = indicator.minScore ?? 0;
  const maxScore = indicator.maxScore;
  const range = maxScore - minScore;
  if (range <= 0) {
    throw new Error(`Invalid scale for ${indicator.id}: maxScore must > minScore`);
  }

  // ---- 自適應：決定本次計分的 active 題集 ----
  const hasDetail = indicator.questions.some(q => q.tier === 'detail');
  const detailRevealed = hasDetail && isDetailRevealed(indicator, answers);
  const activeQuestions = hasDetail && !detailRevealed
    ? indicator.questions.filter(q => q.tier !== 'detail')
    : indicator.questions;
  const N = activeQuestions.length;

  const validAnswerEntries = activeQuestions.map(q => ({
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

  // ---- clinicalCutoff 一律在「螢檢題」上評估（驗證過的短篩），與 detail 是否揭露無關 ----
  let cutoffFlag: boolean | undefined;
  let cutoffSeverity: 'consult' | 'advisory' | undefined;
  let cutoffFlagLabel: string | undefined;
  if (indicator.clinicalCutoff) {
    const screenerQs = indicator.questions.filter(q => q.tier !== 'detail');
    const screenerVals = screenerQs.map(q => ({
      raw: answers[q.id],
      rev: q.reverseScored ?? false,
    })).filter(e => Number.isFinite(e.raw));
    if (screenerVals.length === screenerQs.length) {
      const screenerSum = screenerVals.reduce(
        (s, e) => s + (e.rev ? reverseScoreOf(e.raw, maxScore, minScore) : e.raw), 0);
      const { threshold, comparator, severity, flagLabel } = indicator.clinicalCutoff;
      cutoffFlag = comparator === '>=' ? screenerSum >= threshold : screenerSum <= threshold;
      if (cutoffFlag) {
        cutoffSeverity = severity;
        cutoffFlagLabel = flagLabel;
      }
    }
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
      let subCutoffFlagLabel: string | undefined;
      if (sub.clinicalCutoff) {
        const { threshold, comparator, severity, flagLabel } = sub.clinicalCutoff;
        subCutoffFlag = comparator === '>=' ? subMean >= threshold : subMean <= threshold;
        if (subCutoffFlag) {
          subCutoffSeverity = severity;
          subCutoffFlagLabel = flagLabel;
        }
      }

      return {
        subScaleId: sub.id,
        score: Math.round(100 * subCapacity),
        subMean,
        cutoffFlag: subCutoffFlag,
        cutoffSeverity: subCutoffSeverity,
        cutoffFlagLabel: subCutoffFlagLabel,
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
    cutoffFlagLabel,
    subScaleScores,
    questionsAnswered: validAnswerEntries.length,
    questionsTotal: N,
  };
}
```

- [ ] **Step 4: 跑測試確認通過（含回歸）**

Run: `pnpm vitest run tests/engine/func/scorer.test.ts`
Expected: PASS（新測試 + 既有測試全綠）

- [ ] **Step 5: Commit**

```bash
git add src/engine/func/scorer.ts tests/engine/func/scorer.test.ts
git commit -m "feat(func): scoreLikertIndicator 自適應完成度 + cutoff 在螢檢題評估"
```

---

### Task 4：重構 indicators.yaml

**Files:**
- Modify: `src/data/questionnaire/indicators.yaml`（全檔替換）

- [ ] **Step 1: 替換整個檔案**

把 `src/data/questionnaire/indicators.yaml` 全檔內容替換為下方。要點：移除 `appetite`/`weight_stability`/BAT-12(`burnout`)/`screen_fatigue`；新增 `vitality.nutrition`、`cognition.cognitive_self_report` 螢檢；`fatigue` q2-q4 標 detail + revealDetailWhen；`depression` 擴為 PHQ-9（q3-q9 detail）、`anxiety` 擴為 GAD-7（q3-q7 detail）；`sedentary_time`/`attention_self_report`/`memory_self_report`/`processing_speed`/`executive_function`/`vision_impact`/`hearing_impact`/`stress`/`wellbeing` 整個指標標 `tier: detail`。

```yaml
# src/data/questionnaire/indicators.yaml
# 自適應分層問卷（adaptive tiered）— 見 docs/superpowers/specs/2026-06-01-adaptive-questionnaire-restructure-design.md
# tier: screener（預設，所有人都填）/ detail（篩陽才揭露）
#   - 指標層 tier:detail → 該域 screener band != high 時整個揭露（domain-driven）
#   - 題層 tier:detail   → 由同指標 revealDetailWhen 觸發（within-instrument short→long）

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
  - id: vitality.nutrition
    kind: likert
    domain: vitality
    label: 營養與體重
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: study-developed
    questions:
      - { id: vitality.nutrition.q1, text: "過去 1 個月，您的食慾與體重維持穩定良好嗎？", options: [{label: "明顯變差或下降", score: 0}, {label: "略有變差", score: 1}, {label: "大致穩定", score: 2}, {label: "穩定良好", score: 3}] }
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
    revealDetailWhen: { screenerQuestionIds: [vitality.fatigue.q1], threshold: 2, comparator: ">=" }
    questions:
      - { id: vitality.fatigue.q1, text: "過去 7 天，我感到疲勞", options: [{label: "從不", score: 0}, {label: "很少", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "總是", score: 4}] }
      - { id: vitality.fatigue.q2, text: "過去 7 天，疲勞讓我無法做想做的事", tier: detail, options: [{label: "從不", score: 0}, {label: "很少", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "總是", score: 4}] }
      - { id: vitality.fatigue.q3, text: "過去 7 天，我感到體力被耗盡", tier: detail, options: [{label: "從不", score: 0}, {label: "很少", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "總是", score: 4}] }
      - { id: vitality.fatigue.q4, text: "過去 7 天，疲勞影響我做事的效率", tier: detail, options: [{label: "從不", score: 0}, {label: "很少", score: 1}, {label: "有時", score: 2}, {label: "經常", score: 3}, {label: "總是", score: 4}] }

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
  - id: locomotion.sedentary_time
    kind: likert
    domain: locomotion
    label: 久坐時間
    tier: detail
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: locomotion.sedentary_time.q1, text: "工作日，您每天坐著的時間？", options: [{label: "< 4 小時", score: 0}, {label: "4-6 小時", score: 1}, {label: "6-8 小時", score: 2}, {label: "> 8 小時", score: 3}] }

cognition:
  - id: cognition.cognitive_self_report
    kind: likert
    domain: cognition
    label: 認知功能自評
    style: capacity
    direction: higher_is_better
    maxScore: 3
    weight: 1.0
    license: study-developed
    questions:
      - { id: cognition.cognitive_self_report.q1, text: "過去 1 週，您的專注力與記憶力整體如何？", options: [{label: "很差", score: 0}, {label: "差", score: 1}, {label: "好", score: 2}, {label: "很好", score: 3}] }
  - id: cognition.attention_self_report
    kind: likert
    domain: cognition
    label: 注意力自評
    tier: detail
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
    tier: detail
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
    tier: detail
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
    domain: cognition
    label: 執行功能（TMT-A）
    tier: detail
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
  - id: psychological.depression
    kind: likert
    domain: psychological
    label: 憂鬱篩檢 (PHQ-2 → PHQ-9)
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    loincCode: "55757-9"
    minCompletionPolicy: 1.0
    revealDetailWhen: { screenerQuestionIds: [psychological.depression.q1, psychological.depression.q2], threshold: 3, comparator: ">=" }
    clinicalCutoff:
      threshold: 3
      comparator: ">="
      flagLabel: positive-depression-screen
      severity: advisory
      citation: "Kroenke 2003 (PHQ-2 sens 83% / spec 92%)"
    questions:
      - { id: psychological.depression.q1, text: "過去 2 週，您對任何事都提不起興趣", loincCode: "44250-9", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.depression.q2, text: "過去 2 週，您感到沮喪、憂鬱或無望", loincCode: "44255-8", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.depression.q3, text: "過去 2 週，您入睡困難、睡不安穩，或睡得太多", tier: detail, loincCode: "44251-7", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.depression.q4, text: "過去 2 週，您感到疲倦或沒有活力", tier: detail, loincCode: "44252-5", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.depression.q5, text: "過去 2 週，您食慾不振或吃得過多", tier: detail, loincCode: "44253-3", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.depression.q6, text: "過去 2 週，您覺得自己很糟、是個失敗者，或讓自己/家人失望", tier: detail, loincCode: "44254-1", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.depression.q7, text: "過去 2 週，您對事情專注有困難，例如閱讀報紙或看電視時", tier: detail, loincCode: "44256-6", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.depression.q8, text: "過去 2 週，您動作或說話緩慢到他人已察覺，或正好相反——煩躁、坐立不安，動來動去比平常多", tier: detail, loincCode: "44258-2", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.depression.q9, text: "過去 2 週，您有不如死掉，或用某種方式傷害自己的念頭", tier: detail, loincCode: "44260-8", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
  - id: psychological.anxiety
    kind: likert
    domain: psychological
    label: 焦慮篩檢 (GAD-2 → GAD-7)
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    minCompletionPolicy: 1.0
    revealDetailWhen: { screenerQuestionIds: [psychological.anxiety.q1, psychological.anxiety.q2], threshold: 3, comparator: ">=" }
    clinicalCutoff:
      threshold: 3
      comparator: ">="
      flagLabel: positive-anxiety-screen
      severity: advisory
      citation: "Kroenke 2007 (GAD-2 sens 86% / spec 83%)"
    questions:
      - { id: psychological.anxiety.q1, text: "過去 2 週，您感到緊張、焦慮或坐立不安", loincCode: "69725-0", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.anxiety.q2, text: "過去 2 週，您無法停止或控制擔憂", loincCode: "68509-9", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.anxiety.q3, text: "過去 2 週，您過度擔心各種不同的事情", tier: detail, loincCode: "69733-4", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.anxiety.q4, text: "過去 2 週，您難以放鬆", tier: detail, loincCode: "69734-2", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.anxiety.q5, text: "過去 2 週，您心神不寧到難以安坐", tier: detail, loincCode: "69735-9", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.anxiety.q6, text: "過去 2 週，您變得容易心煩或易怒", tier: detail, loincCode: "69689-8", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
      - { id: psychological.anxiety.q7, text: "過去 2 週，您感到害怕，好像會有可怕的事情發生", tier: detail, loincCode: "69736-7", options: [{label: "從不", score: 0}, {label: "幾天", score: 1}, {label: "超過一半時間", score: 2}, {label: "幾乎每天", score: 3}] }
  - id: psychological.stress
    kind: likert
    domain: psychological
    label: 壓力篩檢 (PSS-4)
    tier: detail
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
  - id: psychological.wellbeing
    kind: likert
    domain: psychological
    label: 心理福祉 (WHO-5)
    tier: detail
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
    tier: detail
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
    tier: detail
    style: symptom
    direction: higher_is_worse
    maxScore: 3
    weight: 1.0
    license: public-domain
    questions:
      - { id: sensory.hearing_impact.q1, text: "過去 1 個月，聽覺問題影響您日常生活的程度？", options: [{label: "無", score: 0}, {label: "輕微", score: 1}, {label: "中度", score: 2}, {label: "嚴重", score: 3}] }
```

- [ ] **Step 2: 跑現有驗證確認可解析**

Run: `pnpm tsx scripts/validate-indicators.ts`
Expected: `[validate-indicators] OK: 18 indicators across 5 domains`（dev 模式 objective norms null 只 warn）

- [ ] **Step 3: Commit**

```bash
git add src/data/questionnaire/indicators.yaml
git commit -m "feat(data): 重構 indicators.yaml 為自適應分層（移除 BAT-12/screen_fatigue，PHQ-9/GAD-7）"
```

---

### Task 5：validate-indicators 加 tier 守門

**Files:**
- Modify: `scripts/validate-indicators.ts`
- Test: `tests/data/validate-indicators.test.ts`（新增）

- [ ] **Step 1: 先寫失敗測試**

新建 `tests/data/validate-indicators.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { validateTierIntegrity } from '../../scripts/validate-indicators';
import type { Indicator } from '../../src/engine/func/questionnaire';

function mk(partial: Partial<Indicator> & { id: string; domain: Indicator['domain'] }): Indicator {
  return {
    kind: 'likert', label: 'x', tier: 'screener', style: 'capacity',
    direction: 'higher_is_better', maxScore: 3, weight: 1.0, license: 'public-domain',
    questions: [{ id: `${partial.id}.q1`, text: 'q', options: [{ label: 'a', score: 0 }, { label: 'b', score: 3 }] }],
    ...partial,
  } as Indicator;
}

describe('validateTierIntegrity', () => {
  it('detail 指標所在域沒有 screener 指標 → 回錯誤', () => {
    const errs = validateTierIntegrity([mk({ id: 'sensory.vision_impact', domain: 'sensory', tier: 'detail' })]);
    expect(errs.some(e => e.includes('sensory') && e.includes('screener'))).toBe(true);
  });

  it('revealDetailWhen 引用不存在的題 → 回錯誤', () => {
    const ind = mk({ id: 'vitality.fatigue', domain: 'vitality' }) as Extract<Indicator, { kind: 'likert' }>;
    ind.revealDetailWhen = { screenerQuestionIds: ['vitality.fatigue.qX'], threshold: 2, comparator: '>=' };
    ind.questions.push({ id: 'vitality.fatigue.q2', text: 'd', tier: 'detail', options: [{ label: 'a', score: 0 }, { label: 'b', score: 3 }] });
    expect(validateTierIntegrity([ind]).some(e => e.includes('qX'))).toBe(true);
  });

  it('有題層 detail 卻無 revealDetailWhen → 回錯誤', () => {
    const ind = mk({ id: 'vitality.fatigue', domain: 'vitality' }) as Extract<Indicator, { kind: 'likert' }>;
    ind.questions.push({ id: 'vitality.fatigue.q2', text: 'd', tier: 'detail', options: [{ label: 'a', score: 0 }, { label: 'b', score: 3 }] });
    expect(validateTierIntegrity([ind]).some(e => e.includes('revealDetailWhen'))).toBe(true);
  });

  it('合法的螢檢+detail 組合 → 無錯誤', () => {
    const screener = mk({ id: 'sensory.functional_acuity', domain: 'sensory' });
    const detail = mk({ id: 'sensory.vision_impact', domain: 'sensory', tier: 'detail' });
    expect(validateTierIntegrity([screener, detail])).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/data/validate-indicators.test.ts`
Expected: FAIL（`validateTierIntegrity` is not exported）

- [ ] **Step 3: 實作 validateTierIntegrity 並接入主流程**

3a. 在 `scripts/validate-indicators.ts` 的 import 之後、`fail` 定義之前，新增可測純函式並匯出：

```ts
import type { LikertIndicator } from '../src/engine/func/questionnaire';

/** 純函式：檢查 tier 完整性，回傳錯誤訊息陣列（空陣列=通過）。 */
export function validateTierIntegrity(indicators: Indicator[]): string[] {
  const errors: string[] = [];
  const byDomain = new Map<string, Indicator[]>();
  for (const ind of indicators) {
    if (!byDomain.has(ind.domain)) byDomain.set(ind.domain, []);
    byDomain.get(ind.domain)!.push(ind);
  }
  // 1. 每個含 detail 指標的域，必須至少有一個 screener 指標
  for (const [domain, list] of byDomain) {
    const hasDetail = list.some(i => i.tier === 'detail');
    const hasScreener = list.some(i => i.tier === 'screener');
    if (hasDetail && !hasScreener) {
      errors.push(`domain ${domain}: 有 detail 指標但無 screener 指標（detail 將永不揭露）`);
    }
  }
  // 2. 題層 detail 的指標必須有 revealDetailWhen，且其 screenerQuestionIds 必須存在且非 detail
  for (const ind of indicators) {
    if (ind.kind !== 'likert') continue;
    const likert = ind as LikertIndicator;
    const detailQs = likert.questions.filter(q => q.tier === 'detail');
    if (detailQs.length === 0) continue;
    if (!likert.revealDetailWhen) {
      errors.push(`indicator ${likert.id}: 有題層 detail 但缺 revealDetailWhen`);
      continue;
    }
    const qById = new Map(likert.questions.map(q => [q.id, q]));
    for (const qid of likert.revealDetailWhen.screenerQuestionIds) {
      const q = qById.get(qid);
      if (!q) errors.push(`indicator ${likert.id}: revealDetailWhen 引用不存在的題 ${qid}`);
      else if (q.tier === 'detail') errors.push(`indicator ${likert.id}: revealDetailWhen 的螢檢題 ${qid} 不可為 detail`);
    }
  }
  return errors;
}
```

3b. 在主流程結尾（第 74 行 charter §0.3 之後、最後 `console.log` 之前）接入：

```ts
const tierErrors = validateTierIntegrity(allIndicators);
for (const e of tierErrors) fail(e);
```

- [ ] **Step 4: 跑測試 + 實檔驗證確認通過**

Run: `pnpm vitest run tests/data/validate-indicators.test.ts && pnpm tsx scripts/validate-indicators.ts`
Expected: 測試 PASS；實檔輸出 `[validate-indicators] OK: 18 indicators across 5 domains`

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-indicators.ts tests/data/validate-indicators.test.ts
git commit -m "feat(build): validate-indicators 加 tier 完整性守門"
```

---

## Phase 2：引擎下游

### Task 6：recommendations 清理與文案更新

**Files:**
- Modify: `src/engine/func/recommendations.ts:66-109`
- Test: `tests/engine/func/recommendations.test.ts`

- [ ] **Step 1: 先寫/改測試**

在 `tests/engine/func/recommendations.test.ts` 加（並移除任何既有針對 `psychological.burnout`、`sensory.screen_fatigue` 的斷言——先 grep 確認）：

```ts
import { describe, it, expect } from 'vitest';
import { recommendationsFor } from '../../../src/engine/func/recommendations';

describe('recommendations 自適應後', () => {
  it('depression advisory cutoff 文案反映已完成 PHQ-9', () => {
    const recs = recommendationsFor('observe', [], [], [
      { indicatorId: 'psychological.depression', domain: 'psychological', severity: 'advisory', flagLabel: 'positive-depression-screen' },
    ]);
    const r = recs.find(x => x.triggerIndicators?.includes('psychological.depression'));
    expect(r?.message).toContain('PHQ-9');
    expect(r?.message).not.toContain('S2');
  });

  it('不再為已移除的 burnout 產生建議', () => {
    const recs = recommendationsFor('observe', [], [], [
      { indicatorId: 'psychological.burnout', domain: 'psychological', severity: 'advisory', flagLabel: 'x' },
    ]);
    expect(recs).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/engine/func/recommendations.test.ts -t 自適應後`
Expected: FAIL（depression 文案含 "S2"；burnout 仍產生建議）

- [ ] **Step 3: 改 recommendations.ts**

3a. `advisoryCutoffRec`（第 66-94 行）：更新 depression/anxiety/stress 文案、刪除 burnout 分支：

```ts
function advisoryCutoffRec(indicatorId: string): Recommendation | null {
  if (indicatorId === 'psychological.depression') {
    return { domain: 'psychological', type: 'in-depth-assessment',
             message: 'PHQ-9 顯示憂鬱症狀，建議找身心科或心理諮商進一步評估。',
             suggestedSpecialties: ['身心科', '精神科', '心理諮商'],
             triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'psychological.anxiety') {
    return { domain: 'psychological', type: 'in-depth-assessment',
             message: 'GAD-7 顯示焦慮症狀，建議找身心科或心理諮商進一步評估。',
             suggestedSpecialties: ['身心科', '精神科', '心理諮商'],
             triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'psychological.stress') {
    return { domain: 'psychological', type: 'self-care',
             message: 'PSS-4 顯示高壓力，建議壓力管理與情緒照顧。',
             triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'psychological.wellbeing') {
    return { domain: 'psychological', type: 'consult-medical',
             message: 'WHO-5 wellbeing 偏低，建議找身心科討論。',
             suggestedSpecialties: ['身心科', '精神科'],
             triggerIndicators: [indicatorId] };
  }
  return null;
}
```

3b. `sensoryIndicatorRec`（第 96-109 行）：刪 screen_fatigue 分支：

```ts
function sensoryIndicatorRec(indicatorId: string): Recommendation | null {
  if (indicatorId === 'sensory.vision_impact') {
    return { domain: 'sensory', type: 'consult-medical', message: '建議找眼科檢查。',
             suggestedSpecialties: ['眼科'], triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'sensory.hearing_impact') {
    return { domain: 'sensory', type: 'consult-medical', message: '建議找耳鼻喉科檢查。',
             suggestedSpecialties: ['耳鼻喉科'], triggerIndicators: [indicatorId] };
  }
  return null;
}
```

- [ ] **Step 4: 跑測試確認通過（含整檔回歸）**

Run: `pnpm vitest run tests/engine/func/recommendations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/func/recommendations.ts tests/engine/func/recommendations.test.ts
git commit -m "refactor(func): recommendations 移除 burnout/screen_fatigue、更新 PHQ-9/GAD-7 文案"
```

---

### Task 7：修復受移除指標影響的既有測試

**Files:**
- Modify: 任何引用 `burnout`/`bat12`/`screen_fatigue`/`appetite`/`weight_stability` 的測試

- [ ] **Step 1: 找出受影響測試**

Run: `grep -rln -E "burnout|bat12|screen_fatigue|weight_stability|appetite" tests/`
Expected: 列出 `tests/engine/func/triage.test.ts`、`tests/engine/func/end-to-end-scoring.test.ts` 等候選

- [ ] **Step 2: 跑全測試看哪些紅**

Run: `pnpm vitest run tests/engine/`
Expected: 列出因指標移除而失敗的測試

- [ ] **Step 3: 逐一修正**

對每個失敗測試：把對已移除指標（burnout/screen_fatigue/appetite/weight_stability）的斷言改為對應的保留指標或移除該斷言；對 PHQ-2/GAD-2 的「2 題」假設，若測試直接讀 `indicators.yaml`，改為「screener 題」語意。修正時逐檔對照 Task 4 的新 YAML（id 與題數）。

- [ ] **Step 4: 跑全引擎測試確認通過**

Run: `pnpm vitest run tests/engine/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "test(func): 修正受指標移除影響的既有測試"
```

---

## Phase 3：UI 與安全

### Task 8：CrisisResources 元件

**Files:**
- Create: `src/components/assess/CrisisResources.svelte`
- Test: `tests/components/CrisisResources.test.ts`（新增）

- [ ] **Step 1: 先寫失敗測試**

新建 `tests/components/CrisisResources.test.ts`（沿用既有 component 測試的 render 方式，參考 `tests/components/QuestionnaireModule.test.ts` 的 import 慣例）：

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import CrisisResources from '../../src/components/assess/CrisisResources.svelte';

describe('CrisisResources', () => {
  it('顯示台灣危機求助資源電話', () => {
    const { getByText, container } = render(CrisisResources, { props: { visible: true } });
    expect(getByText(/1925/)).toBeTruthy();
    expect(getByText(/1995/)).toBeTruthy();
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('visible=false 時不渲染內容', () => {
    const { container } = render(CrisisResources, { props: { visible: false } });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/components/CrisisResources.test.ts`
Expected: FAIL（元件不存在）

- [ ] **Step 3: 建立元件**

新建 `src/components/assess/CrisisResources.svelte`：

```svelte
<script lang="ts">
  interface Props {
    visible?: boolean;
  }
  let { visible = true }: Props = $props();

  const RESOURCES = [
    { label: '安心專線（24 小時）', tel: '1925' },
    { label: '生命線', tel: '1995' },
    { label: '緊急救護', tel: '119' },
  ];
</script>

{#if visible}
  <div class="crisis" role="alert">
    <p class="crisis-title">如果您正經歷自我傷害的念頭，您並不孤單</p>
    <p class="crisis-desc">請立即尋求協助，這些專線全年無休、保密且免費：</p>
    <ul class="crisis-list">
      {#each RESOURCES as r (r.tel)}
        <li>
          <span class="crisis-label">{r.label}</span>
          <a class="crisis-tel" href="tel:{r.tel}">{r.tel}</a>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .crisis {
    border: 2px solid var(--danger);
    background: color-mix(in srgb, var(--danger) 8%, var(--bg));
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    margin: var(--space-4) 0;
  }
  .crisis-title {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: var(--danger);
    margin-bottom: var(--space-2);
  }
  .crisis-desc {
    font-size: var(--text-sm);
    color: var(--text);
    margin-bottom: var(--space-4);
  }
  .crisis-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .crisis-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }
  .crisis-label { font-size: var(--text-base); color: var(--text); }
  .crisis-tel {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--danger);
    text-decoration: none;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    padding: 0 var(--space-3);
  }
</style>
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm vitest run tests/components/CrisisResources.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/assess/CrisisResources.svelte tests/components/CrisisResources.test.ts
git commit -m "feat(assess): 新增 CrisisResources 危機求助資源元件"
```

---

### Task 9：QuestionnaireModule 自適應流程

**Files:**
- Modify: `src/components/assess/QuestionnaireModule.svelte`
- Test: `tests/components/QuestionnaireModule.test.ts`

- [ ] **Step 1: 先寫/改測試**

在 `tests/components/QuestionnaireModule.test.ts` 加（健康路徑：只回答螢檢題，可見題數應為螢檢題數；視測試現有 setup 設定 ageGroup/patient）：

```ts
it('初始只顯示 screener 題（12 題：sleep/nutrition/fatigue.q1/activity/walking/cognitive/PHQ-2×2/self_harm/GAD-2×2/functional_acuity）', async () => {
  // 參考既有測試的 store 初始化方式設定 patient + ageGroup
  // 斷言：第一輪未觸發任何 detail 時，能走訪到的 screener 題總數 = 12
  // （self_harm 為全體必答的自我傷害意念螢檢題，id psychological.self_harm.q1）
  // （細節依本檔既有 render/互動 helper 撰寫）
});

it('PHQ-2 兩題皆答 3（總分 6≥3）→ 揭露 depression detail（q3 出現）', async () => {
  // 回答到 depression.q1=3, depression.q2=3 後，visibleQuestions 應包含 psychological.depression.q3
});
```

> 註：此檔既有測試已建立 render/作答 helper，沿用之。若既有測試斷言「固定 totalQuestions=41」，改為斷言螢檢題語意。

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/components/QuestionnaireModule.test.ts`
Expected: FAIL（目前 flatten 全部題、無 tier 過濾）

- [ ] **Step 3: 改 QuestionnaireModule.svelte**

3a. import 區（第 6-12 行）加入 `isDetailRevealed`、`CrisisResources`、`LikertQuestion` 型別：

```ts
  import {
    indicatorSchema,
    type Indicator,
    type LikertIndicator,
  } from '../../engine/func/questionnaire';
  import { scoreAssessment, isDetailRevealed } from '../../engine/func/scorer';
  import { IC_DOMAIN_NAMES, type ICDomain } from '../../lib/education/schemas';
  import CrisisResources from './CrisisResources.svelte';
```

3b. 在 `FlatQuestion` interface（第 46-55 行）後，把固定 `questions` $derived 換成「答案驅動的 visibleQuestions」。刪除原 `questions`（第 57-71 行）與 `currentIndex`（第 74 行），改為：

```ts
  let answers = $state<Record<string, number>>({});
  let lastAnswerLabel = $state<string | null>(null);
  let phase = $state<'asking' | 'summary'>('asking');
  let isSaving = $state(false);
  let showCrisis = $state(false);

  // 即時域分數（只反映已作答題；未答的 detail 指標自然不計入 → band = screener band）
  const bandByDomain = $derived.by<Partial<Record<ICDomain, 'high' | 'moderate' | 'low'>>>(() => {
    if (!ageGroup) return {};
    const { domainScores } = scoreAssessment({ indicators: ALL_INDICATORS, answers, objectiveResults: {}, ageGroup });
    return Object.fromEntries(domainScores.map(d => [d.domain, d.band]));
  });

  function toFlat(ind: LikertIndicator, q: LikertQuestion): FlatQuestion {
    return {
      indicatorId: ind.id,
      domain: ind.domain,
      domainLabel: DOMAIN_LABELS[ind.domain],
      indicatorLabel: ind.label,
      questionId: q.id,
      text: q.text,
      options: q.options,
      clinicallyReviewed: true,
    };
  }

  // 答案驅動的可見題：螢檢題恆顯示；指標層 detail 於域 band != high 時顯示；
  // 題層 detail 於同指標 revealDetailWhen 觸發時顯示。
  const visibleQuestions = $derived.by<FlatQuestion[]>(() => {
    const out: FlatQuestion[] = [];
    for (const ind of likertIndicators) {
      if (ind.tier === 'detail') {
        const band = bandByDomain[ind.domain];
        if (!band || band === 'high') continue; // 螢檢未完成或正常 → 不展開整個 detail 指標
      }
      const detailRevealed = isDetailRevealed(ind, answers);
      for (const q of ind.questions) {
        if (q.tier === 'detail' && !detailRevealed) continue;
        out.push(toFlat(ind, q));
      }
    }
    return out;
  });

  // 下一個未作答的可見題；皆作答完畢則 null。
  const currentQuestion = $derived<FlatQuestion | null>(
    visibleQuestions.find(q => answers[q.questionId] === undefined) ?? null
  );
  const answeredCount = $derived(Object.keys(answers).length);
  const visibleTotal = $derived(visibleQuestions.length);
  const progressPct = $derived(visibleTotal > 0 ? Math.round((answeredCount / visibleTotal) * 100) : 0);
```

> 需加上 `LikertQuestion` 型別 import：把 3a 的 import 改為 `type Indicator, type LikertIndicator, type LikertQuestion`。

3c. `handleAnswer`（第 107-146 行）改為答案驅動 + 危機偵測。把結尾的 `if (currentIndex < ...)` 區塊替換：

```ts
  async function handleAnswer(option: { label: string; score: number }) {
    if (!currentQuestion || isSaving) return;
    isSaving = true;
    lastAnswerLabel = option.label;
    const qid = currentQuestion.questionId;
    const domain = currentQuestion.domain;
    const indicatorId = currentQuestion.indicatorId;
    const questionText = currentQuestion.text;

    // 安全：自我傷害意念螢檢題（全體必答）勾選非零 → 立即顯示危機資源
    if (qid === 'psychological.self_harm.q1' && option.score > 0) {
      showCrisis = true;
    }

    answers = { ...answers, [qid]: option.score };

    const assessment = assessmentStore.assessment;
    const patient = assessmentStore.patient;
    if (assessment && patient) {
      await recordEvent({
        assessmentId: assessment.id,
        patientId: patient.id,
        moduleType: 'questionnaire',
        eventType: 'questionnaire_answer',
        timestamp: new Date(),
        data: { questionId: qid, indicatorId, domain, questionText, answerLabel: option.label, score: option.score, ageGroup },
        qualityFlags: { isComplete: true, isAnomaly: false },
      });
    }

    isSaving = false;
    await new Promise(r => setTimeout(r, 320));
    lastAnswerLabel = null;

    // currentQuestion 為 derived：設定 answers 後若已無未答可見題 → 進摘要
    if (!currentQuestion) {
      persistScoresToStore();
      phase = 'summary';
    }
  }
```

3d. 模板：進度標籤（第 177 行）改用 `answeredCount`/`visibleTotal`，並在 question 區塊插入危機元件：

```svelte
      <span class="progress-label">已完成 {answeredCount} 題（目前共 {visibleTotal} 題）</span>
```

在 `<h2 class="question-text">` 之前插入：

```svelte
    <CrisisResources visible={showCrisis} />
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm vitest run tests/components/QuestionnaireModule.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/assess/QuestionnaireModule.svelte tests/components/QuestionnaireModule.test.ts
git commit -m "feat(assess): QuestionnaireModule 改為答案驅動的自適應按域展開 + q9 危機觸發"
```

---

### Task 10：結果頁危機再顯示

**Files:**
- Modify: `src/components/assess/ResultView.svelte`

- [ ] **Step 1: 定位插入點**

Run: `grep -n "triageResult\|partialAnalysis\|<script" src/components/assess/ResultView.svelte | head`
讀檔找到分流/旗標摘要區塊的頂部（建議放在分流卡片之上）。

- [ ] **Step 2: 接入危機元件**

在 `ResultView.svelte` `<script>` 加：

```ts
  import CrisisResources from './CrisisResources.svelte';
  import { assessmentStore } from '../../lib/stores/assessment.svelte';

  const selfHarmFlagged = $derived(
    (assessmentStore.partialAnalysis.answers?.['psychological.self_harm.q1'] ?? 0) > 0
  );
```

在結果主內容最上方（分流卡片之前）插入：

```svelte
{#if selfHarmFlagged}
  <CrisisResources visible={true} />
{/if}
```

> 若 ResultView 已 import `assessmentStore`，勿重複 import。

- [ ] **Step 3: 驗證型別**

Run: `pnpm check`
Expected: 無新增 type error

- [ ] **Step 4: Commit**

```bash
git add src/components/assess/ResultView.svelte
git commit -m "feat(assess): 結果頁於 PHQ-9 q9>0 再顯示危機資源"
```

---

### Task 11：E2E 流程更新

**Files:**
- Modify: `tests/e2e/assess-flow.spec.ts`

- [ ] **Step 1: 讀現有 e2e 流程**

Run: `sed -n '1,120p' tests/e2e/assess-flow.spec.ts`
了解既有「填問卷→看結果」步驟與 selector 慣例。

- [ ] **Step 2: 加自適應情境測試**

依既有 selector 慣例，新增三個情境（用既有的 option-btn 點擊 helper）：

```ts
test('健康路徑：全選最佳選項（self_harm 選「從不」），只走 12 題螢檢即進摘要', async ({ page }) => {
  // 進入問卷後，反覆點「最佳」選項（capacity 取最高分、symptom 取最低分，self_harm 取「從不」）
  // 斷言：作答 12 次後出現「問卷完成！」摘要，且未出現 PHQ-8 q3 題幹、未出現危機資源
});

test('憂鬱篩陽：PHQ-2 兩題皆選「幾乎每天」→ 展開 PHQ-8（出現 q3 題幹）', async ({ page }) => {
  // 走到 depression.q1/q2 各選最高分，斷言後續出現「入睡困難、睡不安穩」題幹
});

test('自我傷害意念螢檢題勾選非零 → 出現危機資源（role=alert，含 1925）', async ({ page }) => {
  // self_harm 為全體必答螢檢題（無需先觸發 PHQ）；於該題選非「從不」，斷言 [role=alert] 出現且含文字 1925
});
```

> 題幹文字需與 Task 4 YAML 完全一致（如「過去 2 週，您入睡困難、睡不安穩，或睡得太多」）。

- [ ] **Step 3: 跑 e2e**

Run: `pnpm test:e2e tests/e2e/assess-flow.spec.ts`
Expected: PASS（三情境綠）

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/assess-flow.spec.ts
git commit -m "test(e2e): 自適應問卷健康/篩陽/危機三情境"
```

---

## Task 12：全面驗證

- [ ] **Step 1: 型別 + lint**

Run: `pnpm check && pnpm lint`
Expected: 全綠（無 `any`、無 Svelte 4 store、符合 strict）

- [ ] **Step 2: 單元測試全跑**

Run: `pnpm test`
Expected: 全綠

- [ ] **Step 3: 建置（含 prebuild 守門 + postbuild）**

Run: `pnpm build`
Expected: `validate-indicators` 通過、content-index 一致、build 成功

- [ ] **Step 4: 最終 commit（若有零星修正）**

```bash
git add -A && git commit -m "chore: 自適應問卷重構收尾驗證"
```

---

## Self-Review 對照

- **Spec §4 分層架構**：Task 4（YAML tier）+ Task 9（visibleQuestions 按域展開）✓
- **Spec §5 資料模型（兩層級 tier）**：Task 1（schema）✓
- **Spec §6 分支流程（引擎計分、UI 揭露、按域）**：Task 9（答案驅動、bandByDomain、isDetailRevealed）✓
- **Spec §7 自適應完成度**：Task 3（screener-only N、cutoff on screener）✓
- **Spec §8 PHQ-9 q9 危機**：Task 8（元件）+ Task 9（作答中觸發）+ Task 10（結果頁再顯示）✓
- **Spec §4.2 移除 BAT-12/screen_fatigue**：Task 4（YAML）+ Task 6（recommendations）+ Task 7（測試）✓
- **Spec §9 下游**：Task 6（recommendations）；triage 動態衍生 flag（不需改碼，由 Task 7 回歸測試保證）；content-relevance 按域不需改 ✓
- **Spec §10 測試**：Task 3/5/6/9（Vitest）+ Task 11（Playwright）+ Task 12（prebuild）✓
- **型別一致性**：`isDetailRevealed`、`revealDetailWhen`、`tier`、`validateTierIntegrity` 命名跨 Task 一致 ✓

## 已知範圍界線（非本計畫）

- **PHQ-9/GAD-7 離散嚴重度分級切點**（≥10 中度等）未加 `fullCutoff`；本計畫以 capacity 連續分數驅動域 band 與建議，PHQ-2/GAD-2 cutoff 保留為 advisory flag。如需離散分級為後續增強。
- **客觀測驗（reaction-time/TMT-A）施測 gating**：norms 目前 null（no-op），標 `tier: detail` 僅為 metadata；實際施測流程不在本計畫。
