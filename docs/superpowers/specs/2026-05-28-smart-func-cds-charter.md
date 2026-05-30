# Smart Func CDS — 對齊憲法 (System Charter)

> **Date**: 2026-05-28
> **Status**: Locked。後續所有 sub-project spec 以此為對齊基準。
> **Scope**: smart-func-cds 全專案（S1-S5 子專案）
> **議定來源**: brainstorming session 2026-05-28（Light + Claude）

---

## 為什麼需要這份文件

避免設計過程中「不知道有沒有走彎路」的疑慮。把「**smart-func-cds 開源成人功能健康評估系統 — SMART on FHIR 瀏覽器端 CDS**」這句系統定位**逐詞拆解**，每個詞變成一條硬約束。後續所有設計決定都必須能對應到至少一條約束；違反約束的設計提案必須先修改本文。

---

## §0.1 系統定位逐詞拆解（硬約束）

| 詞 | 硬約束 |
|---|---|
| `smart-func-cds` | repo identity；命名空間 `func.`；模組路徑 `src/engine/func/` |
| **開源** | MIT 或 Apache 公開授權；**不能 hardcode 商業授權量表**（如 Mind Garden 系列、SF 商版） |
| **成人** | 18-64 工作年齡為核心驗證範圍；65+ 不阻擋使用但 UI 提示「建議參考為高齡設計的評估（如 ICOPE / GDS-15）並向醫療人員諮詢」 |
| **功能** | 測 capacity（"我能做到什麼"）為哲學主軸；允許混入必要 symptom-style validated 量表（見 §0.3） |
| **健康評估** | self-report Likert questionnaire → domain 0-100 → triage；非 disease screening、非 diagnosis |
| **系統** | 模組化、版本控管、長期可維護；不是一次性工具 |
| **SMART on FHIR** | Standalone Launch（病患端 OAuth2/PKCE）；FHIR R4；**optional add-on**，不是主流程必要條件 |
| **瀏覽器端** | 零後端、GitHub Pages 部署、IndexedDB 本地存、Web Worker 跑重計算 |
| **CDS**（Clinical Decision Support） | **對病患決策**（自我管理建議、找醫師討論的時機提示）；不是診斷工具、不是給醫師處方依據；**patient-facing copy 禁用 "WHO-validated" / "WHO-recommended" / "ICOPE-based"，可用 "Inspired by WHO IC framework concept"** |

---

## §0.2 用戶角色與運作模式

**Primary user**: 病患自評（不是臨床醫師）

**運作流程**:

```
病患開瀏覽器 (https://yao-care.github.io/smart-func-cds/)
    ↓
填答 self-report Likert questionnaire（純離線、本地）
    ↓
看到自己的雷達 + 自我管理建議（5-domain IC-inspired）
    ↓
[Optional] 點「連線醫院」→ SMART on FHIR Standalone Launch
    ↓
寫回醫院 FHIR Server（病患 OAuth2/PKCE 授權後）
    ↓
PDF 自留 / 給醫師看
```

**設計後果**:
- UI 語氣對病患：白話、不用醫學術語、可選擇看分數細節或只看簡化結果
- 預設離線即可運作；FHIR 不是主流程依賴
- **不需要 EHR Launch**（那是醫師從 HIS 嵌入啟動的場景）
- TriageResult.category 在病患語境用 **`consult`**（「建議找醫師討論」），不用 `refer`（避免「臨床轉介」的醫師主導語感）

---

## §0.3 評估哲學：Capacity + Symptom 混用

WHO IC 哲學以純 capacity 為主軸（測「我能做到什麼」是預防導向），**本系統允許混入 validated symptom-style 量表**（PHQ-9, GAD-7, BAT 等），理由：

- 病患自評需要驗證好的量表來確保信效度
- Capacity-style 題目（"你能應對情緒挑戰嗎"）對病患太抽象，看不懂
- Symptom-style 題目（"過去 2 週你多常焦慮"）病患秒懂、實務可操作

**設計後果**:
- 每個 indicator 在 schema 內標 `style: 'capacity' | 'symptom'`，雷達/UI 可分別呈現或聚合
- Capacity 應為大宗、symptom 為輔；schema 不禁用 symptom-style 量表
- **每個 domain 必須至少有 1 個 capacity-style indicator**（build-time validator 守門）
- 文件背書方向: 「**inspired by WHO IC framework (Beard 2016, Cesari 2018), extended to working-age adults with validated symptom-screening instruments where appropriate**」
- **不寫**「based on WHO ICOPE」（ICOPE 是 60+ only，本系統用不到）

**Cutoff severity 分級**（symptom 信號的 escalation policy）:
- `consult` — 觸發即強制升 consult category（保留給未來確定的高敏感 hard cutoff，如自殺意念題；S1 內無）
- `advisory` — 標 flag 但**不**直升 consult，升 observe + 顯示「進入 S2 in-depth」提示（PHQ-2 ≥3、GAD-2 ≥3 等 sensitivity-first 篩檢工具預設這級，避免 working-age PPV 25-50% 場域的 false-positive 推爆）

---

## §0.4 FHIR Write-back 範圍

當病患選擇「連線醫院」寫回 FHIR Server 時：

| Resource | 內容 | 必/選 |
|---|---|---|
| `QuestionnaireResponse` | 原始問卷答案 + objective 量測值 | 必 |
| `Observation` × 5 | 5 個 IC domain 的 0-100 分數，code 用 LOINC（若有）或自建 CodeSystem URI | 必 |
| `Observation`（整體分流）| 結論 valueCodeableConcept ∈ {normal, observe, consult, **incomplete**}；不用 RiskAssessment（語意不符）| 必 |
| `Observation`（clinical cutoff）| 標記觸發臨床切點的 indicator（PHQ-2 ≥3、GAD-2 ≥3 等）— symptom 信號保留不被 capacity 平均稀釋 | 必（若 cutoff 觸發） |
| `Device` | smart-func-cds@{version}（Provenance.agent.who 引用）；ifNoneExist 避重複 | 必（Provenance 寫入時一同寫）|
| `Provenance` | 標記 patient-generated data + smart-func-cds version；best-effort（401/403 swallow）| 建議（FHIR best practice for PGD）|
| `CarePlan` / `Goal` | 系統給病患的個人化建議 | **不寫** |

對應 §0.1 的 **CDS** 條：對病患決策、不替醫師決策。個人化自我管理建議是病患的事，不寫入醫療紀錄。

---

## §0.5 開源授權約束（量表選型）

凡量表進入 repo（題目文字、計分邏輯、配置 YAML）必須符合下列授權之一：

- ✅ `public-domain`（如 PHQ 系列、GAD 系列）
- ✅ `cc-by` / `cc-by-sa`（部分 CC 量表）
- ✅ `cc-by-nc-sa`（如 BAT、WHO-5；**非商業使用限定**）
- ✅ `research-open-noncommercial`（如 PSS 系列，Cohen 釋出供 non-profit 研究/教育用）
- ⚠️ `study-developed`（自製非 validated 量表；S1 sensory.functional_acuity 暫用，S2/S3 評估改用 HHIE-S 等 public-domain 替代）
- ❌ `commercial`（如 Mind Garden 系列 MBI、Pearson 系列、部分 SF 商版）

License enum 在 schema 內精確標註授權形式，build-time validator 守門（拒絕 `commercial` 或缺失）；deployment context 若轉商業需重審 NC 量表。

**S1 已議定**:

| 用途 | 已選量表 | 授權 | LOINC | 備註 |
|---|---|---|---|---|
| Burnout | **BAT-12**（4 個 sub-scale × 3 題：exhaustion / mental distance / cognitive impairment / emotional impairment）| `cc-by-nc-sa` | — | KU Leuven 2020；**1-5 五點 Likert per Schaufeli manual**；作者宣稱對齊 ICD-11 QD85 burnout 概念三要素，但 ICD-11 未官方背書任何測量工具 |
| Depression 篩 | **PHQ-2** | `public-domain` | **panel `55757-9`**；items `44250-9` / `44255-8`；total score `55758-7`；CMS variant `58120-7` | Kroenke 2003，cutoff ≥3 sens 83% / spec 92%（severity = advisory）|
| Anxiety 篩 | **GAD-2** | `public-domain` | **無專屬 panel LOINC**（GAD-2 = GAD-7 前 2 題）；items `69725-0` / `68509-9` 或 drop loincCode | Kroenke 2007，cutoff ≥3 sens 86% / spec 83%（severity = advisory）|
| Stress 篩 | **PSS-4** | `research-open-noncommercial` | — | **Cohen 1988（PSS-4 short form）+ Warttig 2013 UK norms**；q2/q3 反向計分；advisory cutoff ≥ 9（top 20% high stress） |
| Wellbeing（capacity）| **WHO-5 Well-being Index** | `cc-by-nc-sa` | **無 LOINC**（`71965-1` 在 LOINC 不存在；use local CodeSystem）| 0-5 六點 Likert，補 psychological domain 的 capacity 信號 |
| Fatigue（vitality 內）| **PROMIS Fatigue Short Form 4a** | `cc-by-nc-sa`（HealthMeasures policy）| **`76342-5`**（panel）| 4 題，working-age validated |
| MBI（Maslach）| — | ❌ `commercial` | — | 不採用 |

其他長版量表（PHQ-9, GAD-7, PSS-10, MoCA, PROMIS short forms 完整版等）於 S2 in-depth assessment spec 議定。

---

## §0.6 已議定核心參數匯總（locked）

| 維度 | 鎖定值 | 議定時機 |
|---|---|---|
| 族群 | 18-64 工作年齡成人為核心 | 2026-05-28 |
| 分齡 | 18-39 / 40-54 / 55-64 三段 | 2026-05-28 |
| 資料來源 | self-report Likert + **cognition 互動測試**（反應時間 + TMT-A，零權限）；其他互動模態（mic / cam）defer 到 S2 並需個案 justify 信號增量；v1 無 FHIR/穿戴外部 sensor | 2026-05-28（修訂） |
| 領域 | 5 軸：vitality / locomotion / cognition / psychological / sensory | 2026-05-28 |
| 計分原則 | Likert 加權平均 → 0-100；direction-aware 歸一；clinical cutoff 對實答 raw sum 比較（不對推估值）| 2026-05-28（細節於 S1 spec） |
| Domain band（per-domain）| `high` ≥ 70 / `moderate` 40-69 / `low` < 40 — 詞彙與 triage category 拆開以區分「軸層」vs「整體層」| 2026-05-28（修訂） |
| Triage category（整體）| `normal` / `observe` / `consult` / **`incomplete`**（4 類；完成 < 3 個 domain → incomplete）| 2026-05-28（修訂：加 incomplete）|
| 分流規則 | **判定順序**：(1) ≥1 個 `cutoffSeverity=consult` → consult；(2) completedDomains < 3 → incomplete；(3) 主規則：normal = 全 high 且無 advisory cutoff；observe = 1 個 moderate OR 1 個 moderate + advisory cutoff OR 全 high + advisory cutoff；consult = ≥1 個 low OR ≥2 個 moderate；fallback observe | 2026-05-28（"多域同降" 具體化 + cutoff 兩級 severity）|
| Cutoff severity | `consult`（直升 consult；S1 無實例，保留給未來高敏感 hard cutoff）/ `advisory`（升 observe + S2 提示；PHQ-2/GAD-2 預設這級）| 2026-05-28（修訂）|
| Calibration 目標 | 試點 working-age sample：consult < 20% / incomplete < 10% / normal ≥ 50%；不達標重新檢視分流規則 | 2026-05-28 |
| Likert 解析度 | 混用 0-3 / 0-4 / 1-5 / 0-5 等，per-indicator `maxScore` + `minScore?`（1-based scale 如 BAT-12）；歸一公式 `(sum - N*minScore) / (N*(maxScore-minScore))`；N ≤ 4 題 indicator 要求 100% 完成（per-indicator `minCompletionPolicy` 可 override，WHO-5 等 manual 嚴格要求 100% 用此）；cutoff 對實答 raw sum 比較；支援 `reverseScored` 題（PSS-4 等）| 2026-05-28（修訂）|
| MVP 範圍 | 4 步驟全包（self-screen → in-depth → 個人化建議 → longitudinal monitoring） | 2026-05-28 |
| 框架背書 | "Inspired by WHO IC framework, working-age extension" | 2026-05-28 |
| Primary user | 病患自評 | 2026-05-28 |
| FHIR launch | Standalone Launch only（optional） | 2026-05-28 |
| FHIR write-back | QuestionnaireResponse + 5×Observation（domain）+ 1×Observation（triage category）+ 0..n×Observation（clinical cutoff，若觸發）+ Provenance（agent.who 用 Device pattern）；**不**寫 RiskAssessment / CarePlan / Goal | 2026-05-28（修訂）|
| Burnout 量表 | BAT-12 | 2026-05-28 |
| 評估哲學 | Capacity + Symptom 混用 | 2026-05-28 |
| 工程取向 | 「鎖頭就拔」直接替換，不保留兒科 backward compatibility | 2026-05-28 |
| 子專案拆解 | S1（核心 schema + Step 1 + 兒科退場）→ S2 → S3 → S4 → S5 | 2026-05-28 |

---

## §0.7 Traceability 程序承諾

**每個 sub-project spec（S1, S2, ...）的每個章節開頭，必須引用本憲法的哪幾條約束。**

範例：

> ### §2.3 Likert scoring 規則
> **對齊**: §0.1 `健康評估` + `功能` + §0.3 評估哲學（Capacity + Symptom）+ §0.6 計分原則

**設計變更程序**:

1. 任何違反本憲法的設計提案，必須先在 PR/issue 中明示「擬修改 §0.X 條」
2. 修改本文需附 dated 變更紀錄（在 §0.8 新增）
3. 不接受「順手改」、必須是明示決定
4. 任何時候對齊有疑慮，回查本文

---

## §0.8 變更紀錄

| 日期 | 修改 | 說明 |
|---|---|---|
| 2026-05-28 | 建立本文 | brainstorming session 議定（Light + Claude） |
| 2026-05-28 | 修訂 §0.6「資料來源」 | 原框架（self-report vs FHIR/穿戴）漏列「瀏覽器原生互動測試」一條。經原則性審視（每候選問「Likert 是否抓不到？/ working-age validated？/ 自評替代是否夠用？」），S1 加入「反應時間 + TMT-A」於 cognition domain——補 Likert 抓不到的處理速度與執行功能信號、零權限、validated。其他互動模態（verbal fluency / Digit-in-Noise / MediaPipe Pose / rPPG / prosody / keystroke dynamics）逐一過篩，僅 verbal fluency 與 DiN 保留為 S2 條件候選；pose / rPPG / prosody / keystroke 不納入規劃。 |
| 2026-05-28 | 修訂 §0.4 FHIR write-back 範圍 | 增列 `Observation`（clinical cutoff，code = ic-clinical-cutoff）與 `Provenance`。理由：cutoffFlag 是 symptom 層硬信號，不應被 capacity 平均稀釋；Provenance 為 patient-generated data FHIR best practice。對應 round 1 charter / FHIR reviewer C1。 |
| 2026-05-28 | 修訂 §0.5 開源量表授權約束 | License enum 從籠統 `cc / public-domain / research-open` 細化為 5 類（含 `cc-by-nc-sa` / `research-open-noncommercial` / `commercial`）；S1 已議定量表表格擴充加入 PHQ-2 / GAD-2 / PSS-4 / WHO-5 / PROMIS Fatigue（原 spec 鎖定但 charter 未授權）；BAT-12 對 ICD-11 對齊改為「作者宣稱」措辭（非 ICD-11 官方背書）。對應 round 1 charter M1 + clinical M1。 |
| 2026-05-28 | 修訂 §0.6 分流結構 | Domain band（per-domain）與 Triage category（整體）拆開為兩套詞彙——band ∈ {high, moderate, low}，category ∈ {normal, observe, consult, **incomplete**}。`incomplete` 為新增第 4 個 category（completedDomains < 3 時觸發），對齊 §0.1「健康評估」不在資料不足時給虛假確信。對應 round 1 charter C2 + M3 + engineering M6。 |
| 2026-05-28 | 修訂 §0.6 分流規則 | 「多域同降」具體化為「≥2 個 moderate **或** ≥1 個 low **或** ≥1 個 cutoffFlag 觸發」→ consult。閾值待 calibration（spec §4 載入合成資料模擬，目標 consult 率 < 20%）。對應 round 1 clinical M3 + M4。 |
| 2026-05-28 | 修訂 §0.6 計分原則 | 補 cutoff 對實答 raw sum 比較（不對推估值）+ 短量表（N ≤ 4）要求 100% 完成。避免單題推估觸發 false-positive cutoffFlag。對應 round 1 engineering C3 + clinical 部分填答。 |
| 2026-05-28 | 修訂 §0.6 line 132 分流規則 | 原列「任一 cutoffFlag → consult」與 spec §4.1 兩級 cutoff severity 矛盾；修為「cutoffSeverity=consult 直升；advisory 升 observe」。對應 round 2 charter NC1。 |
| 2026-05-28 | 修訂 §0.6 line 138 FHIR write-back | 原列 `RiskAssessment` 與 §0.4 修訂版 + spec §4.8 矛盾；修為「QR + 5 Obs (domain) + 1 Obs (triage) + 0..n Obs (cutoff) + Provenance」。對應 round 2 charter NC2 + 工程 NM13。 |
| 2026-05-28 | 增訂 §0.6 Cutoff severity + Calibration 目標 + §0.3 Cutoff severity 條 | spec §4.1 / §4.2 / §4.9 已在 v2 規範但 charter 未收錄。對應 round 2 charter NM1 + NM2。 |
| 2026-05-28 | 增訂 §0.1 CDS 條 patient-facing copy 約束 | 禁用 "WHO-validated" / "WHO-recommended" / "ICOPE-based"；spec §4.6 已在 v2 規範但 charter 未收錄。對應 round 2 charter NM3。 |
| 2026-05-28 | 修訂 §0.5 LOINC 欄 + BAT-12 Likert 範圍 | PHQ-2 panel 改 `55757-9`（原 `55758-7` 是 total）；GAD-2 無專屬 panel LOINC（drop or 個別 item）；WHO-5 `71965-1` 在 LOINC 不存在（drop）；BAT-12 改 1-5 Likert 對齊 Schaufeli 2020 manual；PSS-4 註記 q2/q3 反向計分。對應 round 2 FHIR NC1/NC2/NC3 + clinical NC2/NC3 + NC1。 |
| 2026-05-28 | 修訂 §0.6 Likert 解析度 | 拓寬至 0-3 / 0-4 / 1-5 / 0-5 混用，新增 reverseScored 題支援。對應 round 2 engineering NC1 + clinical NC2/NC3。 |
| 2026-05-28 | 修訂 §0.1 「成人」65+ advisory + §0.4 增列 Device 寫回 + §0.6 補 minScore / minCompletionPolicy 機制 + 修正歸一公式 | round 3 charter NM-R3-1（ICOPE/GDS-15 並列）+ NM-R3-2（Device 為一級 FHIR write-back resource）+ NM-R3-3（minScore 與 minCompletionPolicy per-indicator override 入 charter）+ round 3 clinical NC1 / engineering NC1（公式對 1-based scale 數學錯，已修為 `(sum - N*minScore) / (N*(maxScore-minScore))`）。|
| 2026-05-28 | 修訂 §0.5 補 `study-developed` license + PROMIS Fatigue 4a LOINC `76342-5` + PSS-4 citation 精確化 | round 4 charter M-R4-1 / M-R4-2 / M-R4-4：v3 修了 spec 內等項但 charter §0.5 漏跟。 |

---

## §0.9 後續工作（待 spec 列表）

| Slice | spec 檔名 | 狀態 |
|---|---|---|
| S1 | `2026-05-28-s1-core-schema-and-step1-design.md` | 待寫（brainstorming session 進行中） |
| S2 | `YYYY-MM-DD-s2-in-depth-assessment-design.md` | 待 S1 完成後啟動 |
| S3 | `YYYY-MM-DD-s3-personalised-care-plan-design.md` | 待 S2 完成後啟動 |
| S4 | `YYYY-MM-DD-s4-longitudinal-monitoring-design.md` | 待 S3 完成後啟動 |
| S5 | `YYYY-MM-DD-s5-brand-deploy-cleanup-design.md` | 可平行；最終切換在最後 |

---

## 引用來源（與背書）

- WHO Intrinsic Capacity 框架基礎：Beard JR et al. *Lancet* 2016; Cesari M et al. *J Gerontol A* 2018
- 為何不用 ICOPE：本系統族群為 working-age 18-64，[WHO ICOPE 官方對象為 60+ 老人](https://www.who.int/news-room/questions-and-answers/item/population-ageing)，學術界 IC 延伸驗證最低至 45 歲（Dunedin Study，PMC12760625），18-44 無官方驗證
- BAT-12 burnout：Burnout Assessment Tool, KU Leuven 2020, Creative Commons
- 詳細研究背景: `docs/superpowers/research/2026-05-28-who-ic-framework-research.md`
