# 自適應分層問卷重構設計（adaptive tiered questionnaire）

- 日期：2026-06-01
- 狀態：設計通過，待寫實作計畫
- 範圍：`src/data/questionnaire/indicators.yaml` 重構 ＋ assess 流程改為動態分層調配

## 1. 問題

現行問卷 41 題（不含 2 個 cognition 客觀測驗）存在三類問題：

- **跨量表概念重複**：疲勞被問三次（`vitality.fatigue` ↔ BAT-12 精疲力竭子量表 ↔ WHO-5 精力題）；認知被問兩次（`cognition` 自評 ↔ BAT-12 認知失能子量表）。
- **感官 double-count**：`sensory.functional_acuity` 一題就重複問了視覺＋聽覺，後面又拆成 `vision_impact`、`hearing_impact`。
- **瑣碎單題**：`appetite`、`weight_stability`、`screen_fatigue` 臨床資訊量低。
- **結構失衡**：psychological 域佔 25 題（61%），locomotion 僅 3 題。

現行 41 題組成：

| 域 | 題數 | 內容 |
|---|---|---|
| vitality | 7 | sleep×1、appetite×1、weight×1、PROMIS 疲勞×4 |
| locomotion | 3 | activity×1、sedentary×1、walking×1 |
| cognition | 2（＋2 客觀） | attention 自評×1、memory 自評×1（＋反應時間、TMT-A，norms 目前 null=no-op） |
| psychological | 25 | WHO-5×5、BAT-12×12、PHQ-2×2、GAD-2×2、PSS-4×4 |
| sensory | 4 | functional_acuity×1、vision×1、hearing×1、screen_fatigue×1 |

## 2. 關鍵限制：驗證量表不可拆題

WHO-5、BAT-12、PHQ-2、GAD-2、PSS-4、PROMIS 疲勞都是有臨床切點＋文獻引用的驗證量表。其切點（如 PHQ-2 ≥3、WHO-5 ≤13）**只在保留全部題目時成立**，不可在量表內部刪題。因此整併只有兩條路：**整套保留或整套移除**某量表；瑣碎的自製單題才可自由合併或刪除。

## 3. 目標與取向

採 **方案 C 積極精簡 ＋ 動態分層調配（adaptive tiered）**：先問最少題（Tier-1 screener），當分數顯示有問題時才追問詳細題（Tier-2 detail）。讓健康受測者負擔極低，有問題者才獲得完整評估。

分層展開採 **混合模型**（每種構念用臨床上最對的展開方式）：

- **心理域走驗證過的 short→long**：PHQ-2 是 PHQ-9 前 2 題、GAD-2 是 GAD-7 前 2 題；臨床指引（USPSTF 等）的標準用法即「短版篩檢、篩陽才補足整套做嚴重度分級」。public domain，不需發明新量表。
- **其餘四域走 domain-band 展開**：活力/行動/認知/感官無驗證過的 short→long 配對，硬做就是發明未驗證臨床工具（違反專案鐵則）。採「簡短篩檢題 → 域 band 進 low/moderate 才展開該域詳細指標」，即標準的 triage-to-fuller-assessment。

## 4. 分層架構

### 4.1 Tier-1 通用篩檢（所有人都填，共 11 題）

| 域 | Tier-1 螢檢題 | 觸發條件 | Tier-2 detail（僅篩陽者） |
|---|---|---|---|
| vitality | `sleep_quality`、`fatigue` q1、`nutrition`（食慾+體重併）= 3 | 域 band low/mod 或疲勞篩偏高 | `fatigue` q2-q4（補足 PROMIS） |
| locomotion | `activity_level`、`walking_ability` = 2 | 域 band low/mod | `sedentary_time` |
| cognition | `cognitive_self_report`（注意+記憶併）= 1 | 自評偏低 | 拆 `attention`/`memory` ＋ 啟用 `processing_speed`、`executive_function` 客觀測驗 |
| psychological | `depression` q1-2（PHQ-2）、`anxiety` q1-2（GAD-2）= 4 | PHQ-2≥3 / GAD-2≥3 | PHQ-2 陽→PHQ-9 q3-9；GAD-2 陽→GAD-7 q3-7；任一陽→`stress`(PSS-4)、`wellbeing`(WHO-5) |
| sensory | `functional_acuity`（綜合）= 1 | 偏低 | 拆 `vision_impact`/`hearing_impact` |

### 4.2 移除

- **BAT-12（職業倦怠，整套 12 題）**：理由 (1) 職業專屬，非在職成人不適用，本系統為通用成人 IC；(2) 4 個子量表各自與既有指標撞題（精疲力竭↔疲勞、認知失能↔認知、情緒失調↔焦慮/壓力）。移除後跨域重複幾乎全消，心理域瘦身一半。緩解：PSS-4＋WHO-5 涵蓋壓力與福祉構念；衛教文 `understanding-burnout` 保留作 browse-only。
- **`screen_fatigue`**：瑣碎、與視覺重疊。

### 4.3 題量效果

健康者只填 11 題即結束；單域篩陽 +1〜+4；心理篩陽可深至完整 PHQ-9＋GAD-7＋PSS-4＋WHO-5。全域篩陽才接近原本題量——這正是動態調配的目的：深度按需供給。

## 5. 資料模型（indicators.yaml / Zod schema）

tier 需在**兩個層級**表達：

### 5.1 量表內 short→long（心理域）—— tier 標在「題」層級

把 PHQ-9 還原成單一指標 `psychological.depression`，9 題裡 q1-q2 為內嵌 PHQ-2 螢檢、q3-q9 標 `tier: detail`；指標帶 `screenerCutoff`（對 q1-2 算 PHQ-2 ≥3）決定是否揭露 q3-q9。GAD-7 同理（q1-2 = GAD-2）。如此 PHQ-9/GAD-7 仍是一個完整量表，切點與文獻一致。`stress`(PSS-4)、`wellbeing`(WHO-5) 為整個指標 `tier: detail`，由心理域任一螢檢陽觸發。

### 5.2 域內展開（其餘四域）—— tier 標在「指標」層級

每域部分指標 `tier: screener`、部分 `tier: detail`；detail 指標在「該域 screener 算出的 band ∈ {low, moderate}」時整批揭露。

### 5.3 Schema 變更（`src/engine/func/questionnaire.ts`）

- 新增 `tier: 'screener' | 'detail'`（預設 `screener`），可標於指標層與 likertQuestion 層。
- 指標層新增 `screenerCutoff`（指定哪些題組成螢檢、其 threshold/comparator/flagLabel）。
- `scripts/validate-indicators.ts` 加守門：detail 指標必須是某 screener 的展開目標（不可成孤兒）；`screenerCutoff` 引用的題必須存在。

## 6. 分支流程與引擎分工

維持「計分在引擎、UI 只揭露」鐵則，揭露時機採**按域展開**：

1. UI 按域逐一呈現 Tier-1 螢檢題。
2. 一個域的螢檢題答完 → 丟給引擎算該域 band（及心理域 PHQ-2/GAD-2 cutoff）。
3. 引擎回傳「要解鎖哪些 detail 區塊」→ UI 就地（同域、答完螢檢後）展開追問，答完才進下一域。
4. PHQ-9 第 9 題勾選非零 → 立即顯示危機資源元件（非阻擋式）。
5. 全程部分作答由 scorer 處理；未觸發的 detail 題視為「未觸發」而非「未完成」。

## 7. 計分與自適應完成度

- **band 只由已作答題目計算。** 未觸發 detail 的域 → band 來自螢檢題；既然沒 flag，該域即 `high`。detail 只在已 flag 的域內細化分數與旗標，不會推翻 flag（detail 僅在 low/mod 時出現，落在已標記範圍內）。
- **`minCompletionPolicy` 重新定義**為「螢檢題完成率」；未觸發的 detail 題不計入分母。
- 心理域：PHQ-2/GAD-2 螢檢負 → 域分數由雙篩決定（screened-negative = high）；螢檢陽 → PHQ-9/GAD-7 全量尺給嚴重度分級。

## 8. PHQ-9 第 9 題（自殺/自傷意念）安全處理

保留**完整 PHQ-9 含第 9 題**（最具臨床價值，PHQ-9 正規用法）。新增 `CrisisResources.svelte`：第 9 題分數 >0 即顯示（非阻擋式橫幅/卡片），列台灣資源（1925 安心專線、1995 生命線、110/119），用 `--danger` token（對齊 `LEVEL_TO_COLOR` critical）。結果頁若帶此旗標再顯示一次。目前 codebase 無可重用危機 UI（僅 `mood-self-awareness.md` 一句話），需新做。

## 9. 下游改動（已查證，耦合鬆）

- `src/engine/func/triage.ts`：flag 由指標**動態衍生**（`ind.cutoffFlagLabel ?? ...`），移除量表不需改碼，旗標自然消失。
- `src/data/education/content-relevance.yaml`：trigger 按 `func.domain.<域>.<band>.<age>` 計，非按量表旗標，按域不需改結構；`understanding-burnout` 保留 browse-only。
- `src/engine/func/recommendations.ts`：刪 `psychological.burnout`、`sensory.screen_fatigue` 分支；`psychological.stress` 保留（PSS-4 轉 detail）；新增 PHQ-9 嚴重度建議。
- `src/engine/func/scorer.ts`、`radar-scoring.ts`：套用自適應完成度。
- `src/components/assess/QuestionnaireModule.svelte`、`AssessmentShell.svelte`：按域分支揭露。

## 10. 測試

- **Vitest**：螢檢-only vs 展開的計分；PHQ-2→PHQ-9 cutoff 閘門；band 一致性（detail 不推翻 flag）；新 `minCompletionPolicy` 分母。
- **Playwright**：健康路徑 11 題即結束；篩陽路徑展開；PHQ-9 q9 觸發危機元件。
- prebuild：`validate-indicators` 通過；content-index 一致性。

## 11. 未決 / 待實作計畫釐清

- nutrition 合併題與 cognition 合併自評題的確切題幹與計分量尺（自製，study-developed）。
- 各域 screener band 門檻與 detail 觸發的精確數值（沿用現行 high≥70/mod40-69/low<40，detail 觸發 = band ∈ {low,moderate}）。
- 危機資源元件的確切文案與顯示位置（作答中 vs 結果頁）。
