# WHO Intrinsic Capacity / 功能健康評估官方指引彙整

> **研究日期**：2026-05-28
> **目的**：為 `smart-func-cds`（成人功能健康評估、SMART on FHIR 瀏覽器端）盤點 WHO 與權威機構的官方指引，作為設計 spec 的證據基礎。
> **原則**：只收 evidence-based、附原始 URL 的內容；找不到官方文件即明示。

---

## 1. WHO ICOPE Handbook / Guidelines on Integrated Care for Older People

### 1.1 版本與時間軸（官方）

| 文件 | 年份 | 來源 |
|---|---|---|
| WHO Guidelines on Integrated Care for Older People (ICOPE) | 2017 | [who.int/teams/.../icope](https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/ageing-and-health/integrated-care-for-older-people-icope) |
| ICOPE Handbook 1st ed.（Guidance for person-centred assessment and pathways in primary care） | 2019 | 同上 |
| **ICOPE Handbook 2nd edition** | **2024/2025 上線** | [WHO 出版頁](https://www.who.int/publications/b/71300)、[Decade of Healthy Ageing 公告](https://www.decadeofhealthyageing.org/find-knowledge/resources/publications/integrated-care-for-older-people-(-icope)-guidance-for-person-centred-assessment-and-pathways-in-primary-care-second-edition) |

2nd edition 將原本五步驟簡化為四步驟：(1) basic assessment + community-level interventions，(2) in-depth assessment，(3) personalised care plan，(4) implementation and monitoring。新增 urinary incontinence care pathway，並擴充第一步驟。來源：[WHO 線上發表 webinar 頁面（2025/1/29）](https://www.who.int/news-room/events/detail/2025/01/29/default-calendar/webinar--integrated-care-for-older-people-handbook-(icope-handbook)-guidance-for-person-centred-assessment-and-pathways-in-primary-care--second-edition)。

### 1.2 五個 IC Domain 的官方定義（Cesari/Beard 用詞）

| Domain（英） | 中譯 | 定義來源 |
|---|---|---|
| Cognition | 認知 | Cesari 2018 等同 ICOPE 體系認知能力 |
| Locomotion | 行動／運動 | 肌肉骨骼與行動能力 |
| Vitality | 生命力／活力 | "underlying physiological determinants … nutrition, energy balance"（[Lancet Healthy Longevity 2022 工作定義](https://www.thelancet.com/journals/lanhl/article/PIIS2666-7568(22)00200-8/fulltext)） |
| Psychological | 心理 | 情緒、動機 |
| Sensory | 感官（含視覺與聽覺） | 視/聽 |

頂層定義（Beard 2016 World Report on Ageing and Health，Lancet 387:2145-2154）：
- **Intrinsic capacity**：「the composite of all the physical and mental (including psychosocial) capacities that an individual can draw on at any point in time.」
- **Functional ability**：IC 與環境互動的合成。
- **Healthy ageing**：「the process of developing and maintaining the functional ability that enables wellbeing in older age.」
- 來源：[PMC4848186](https://pmc.ncbi.nlm.nih.gov/articles/PMC4848186/)、[Lancet abstract](https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(15)00516-4/abstract)。

五個 domain 的選定依據：Cesari M, Araujo de Carvalho I, Thiyagarajan JA, Cooper C, Martin FC, Reginster JY, Vellas B, Beard JR. "Evidence for the Domains Supporting the Construct of Intrinsic Capacity." *J Gerontol A Biol Sci Med Sci* 2018;73(12):1653-1660. DOI: 10.1093/gerona/gly011。來源：[Oxford Academic](https://academic.oup.com/biomedgerontology/article/73/12/1653/4834876)、[PubMed 29408961](https://pubmed.ncbi.nlm.nih.gov/29408961/)。論文明示「Using the International Classification of Functioning, Disability and Health (ICF) framework as background」，5 個 domain 是依 ICF body functions 對應出來，並非從原始大樣本 EFA 跑出來的。

### 1.3 Step 1 篩檢工具的 9 個題目（官方 6 domain → 9 items）

> ICOPE Step 1 是 **9 個 item，分布在 5 個 domain（感官分視/聽）**，文獻常稱「6 題」是指 6 個 domain；實際 item 數為 9。

依 [VIMCI 驗證研究（BMC Geriatrics 2023, PMC9945724）](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9945724/) 與 [Diagnostic performance analysis（PMC10463906）](https://pmc.ncbi.nlm.nih.gov/articles/PMC10463906/)：

| Domain | Item | 原始題型 | 異常 cut-off |
|---|---|---|---|
| Cognition | 1. 三字回憶（3-word recall） | 「Cannot recall three words」 | 無法完整回憶 → 異常 |
| Cognition | 2. 時間/地點定向 | 「Disorientation in time or space」 | 任一錯誤 → 異常 |
| Locomotion | 3. Chair-rise / 5-times sit-to-stand | 「Five times sit-to-stand test ≥ 14 s」 | **≥ 14 秒 → 異常** |
| Vitality | 4. 體重變化 | 「Loss more than 3 kg of weight in the past 3 months」 | **3 個月內 > 3 kg → 異常** |
| Vitality | 5. 食慾 | 「Loss of appetite in the past 3 months」 | 是 → 異常 |
| Psychological | 6. 情緒低落（PHQ-2 #1） | 「Depressed or hopeless in the past two weeks」 | 是 → 異常 |
| Psychological | 7. 失去興趣（PHQ-2 #2） | 「Lost interest in activities in the past two weeks」 | 是 → 異常 |
| Sensory–Vision | 8. 視覺自陳 | 「Vision deteriorated and affected daily life」 | 是 → 異常 |
| Sensory–Hearing | 9. 聽覺自陳 | 「Hearing deteriorated and affected daily life」 | 是 → 異常 |

**整體分流規則**：依 PMC10463906「a score of ≥ 1 indicates possible IC decline」，即 **任一 item 異常 → 進入 Step 2 in-depth assessment**（非加總式分數，是 per-domain binary flag）。WHO 設計上是篩檢工具（敏感度優先），實證敏感度約 94.6%、特異度 62.3%（[PMC10463906](https://pmc.ncbi.nlm.nih.gov/articles/PMC10463906/)）。

### 1.4 Step 2 In-Depth Assessment Tools

依文獻歸納（[scoping review on sensitivity/specificity of ICOPE](https://www.sciencedirect.com/science/article/abs/pii/S0378512223004243)、[Singapore ICOPE PMC10737100](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10737100/)、[Taiwan ICOPES-TW PMC11141031](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11141031/)、[Diagnostic perf PMC10463906](https://pmc.ncbi.nlm.nih.gov/articles/PMC10463906/)）：

| Domain | Step 2 工具 |
|---|---|
| Cognition | **MMSE** 或 **MoCA**（多數試點用 MMSE，WHO Handbook 推薦使用標準化認知評估） |
| Locomotion | **SPPB**（Short Physical Performance Battery）、握力、步速 |
| Vitality | **MNA-SF**（Mini-Nutritional Assessment – Short Form），有時加 **SARC-F** 排查肌少症 |
| Psychological | **GDS**（老年用）或 **PHQ-9**（一般成人）、**GAD-7** 排查焦慮 |
| Sensory（vision） | 視力檢查表（Snellen 等） |
| Sensory（hearing） | Whisper test / 純音聽力測試 |

注意：第二版 Handbook 的具體 Step 2 工具列表，**研究員無法從 WHO 線上頁面取得乾淨可解析的文字**（PDF 為點陣化內容，[cdn.who.int 的 ICOPE brochure](https://cdn.who.int/media/docs/default-source/ageing/who-alc-icope-brochure.pdf) 與 [segg.es ICOPE-handbook-2nd-final.pdf](https://www.segg.es/media/descargas/ICOPE-handbook-2nd-final.pdf) 均回傳 binary，無法擷取確認）。**上述 Step 2 工具來自同儕審查研究與試點實作描述**，不是 Handbook 原文直引。在實作時請以官方 Handbook 2nd edition 的工具列為準。

### 1.5 目標年齡

**沒有明確下限與上限**。但 WHO 在所有相關出版物採 UN 標準 **「older people = 60+」**：
- [WHO Q&A: Population ageing](https://www.who.int/news-room/questions-and-answers/item/population-ageing) — 「In WHO statistics, we use the United Nations' standard for the categorization of older persons: those aged 60 years and older.」
- ICOPE Handbook 標題即「Integrated Care for **Older** People」。
- 試點研究多採 **60+** 或 **65+** 為納入標準（[VIMCI](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9945724/)、[Singapore](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10737100/)、[Taiwan ICOPES-TW](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11141031/)）。
- **WHO 從未在官方文件中將 ICOPE 推薦給 18–64 工作年齡成人。**

---

## 2. WHO IC 框架的基礎文獻

| 文獻 | 角色 | URL |
|---|---|---|
| Beard JR, et al. "The World report on ageing and health: a policy framework for healthy ageing." *Lancet* 2016;387(10033):2145-2154 | IC + functional ability 概念首次正式提出 | [PMC4848186](https://pmc.ncbi.nlm.nih.gov/articles/PMC4848186/)、[Lancet](https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(15)00516-4/abstract) |
| Cesari M, et al. "Evidence for the Domains Supporting the Construct of Intrinsic Capacity." *J Gerontol A* 2018;73(12):1653-1660 | 5 個 domain 的依據 | [Oxford Academic](https://academic.oup.com/biomedgerontology/article/73/12/1653/4834876) |
| Bautmans I, et al. "WHO working definition of vitality capacity for healthy longevity monitoring." *Lancet Healthy Longevity* 2022 | Vitality domain 之 WHO 工作定義 | [Lancet HL](https://www.thelancet.com/journals/lanhl/article/PIIS2666-7568(22)00200-8/fulltext) |
| Lu et al. INSPIRE-T cohort, "Reference centiles for intrinsic capacity throughout adulthood." *Nature Aging* 2023 | IC 在成年期參考百分位 | [Nature Aging](https://www.nature.com/articles/s43587-023-00522-x)（abstract 公開，全文需登入） |
| Campbell K, et al. ELSA – Operationalization of IC | IRT-based IC composite | [PMC10061563](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10061563/) |
| Wallace LMK 等 – Validating IC in Dunedin midlife cohort (age 45) | **IC 概念延伸到 45 歲的初步驗證** | [PMC12760625](https://pmc.ncbi.nlm.nih.gov/articles/PMC12760625/) |
| "Adverse health effects of declined intrinsic capacity in middle-aged and older adults" meta-analysis | Middle-aged 在 IC 研究中的定義（45–60/65） | [Age & Ageing 2024](https://academic.oup.com/ageing/article/53/7/afae162/7721455) |

### 對非高齡族群的延伸

- **Beard 2016 原文即強調生命週期**：「the report considers ageing from a life-course perspective, but focuses on the second half of life.」WHO 模型中 IC 在「early adulthood 達峰，midlife 後下滑」（[Sergeyev/Dunedin 預印本](https://sites.duke.edu/moffittcaspiprojects/files/2025/10/Sergeyev_Dunedin_ChildhoodPredictorIC_29October2025_NS.pdf)）。
- **Dunedin Study（PMC12760625）** 是目前**最低年齡 IC 驗證研究（age 45）**，明示：「Currently, the youngest participants in validation studies are 45, and most are over 65.」bifactor 模型在 45 歲 fit 良好，但**仍 ≥ 45 歲、非 18–64 全段**。
- **18-44 工作年齡 IC 驗證**：未找到官方或大型同儕審查驗證研究。

---

## 3. 各 Domain 的標準量表

### 3.1 Cognition

| 工具 | 目標族群 | 用途 | LOINC |
|---|---|---|---|
| ICOPE Step 1：orientation + 3-word recall | 60+ | 篩檢 | — |
| MMSE | 65+ 為主 | 篩檢/監測 | 數個（如 72172-0 為 MoCA total） |
| **MoCA** | 18+ 通用 | 輕度認知障礙篩檢 | [72133-2 (panel)](https://loinc.org/72133-2)、[72172-0 (total)](https://loinc.org/72172-0)、[LP156676-1](https://loinc.org/LP156676-1) |
| PROMIS Cognitive Function (Adult) | 18+ | PRO | [HealthMeasures](https://www.healthmeasures.net/explore-measurement-systems/promis) |

### 3.2 Locomotion

| 工具 | 目標族群 | 備註 |
|---|---|---|
| ICOPE chair-rise (5x sit-to-stand) | 60+ | cut-off **≥ 14 s** ([PMC10463906](https://pmc.ncbi.nlm.nih.gov/articles/PMC10463906/)、[Validation PMC8680757](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8680757/)) |
| SPPB | 老年為主 | Step 2 主力 |
| Gait speed | 老年 | < 0.8 m/s 為 frailty risk |
| Grip strength | 全年齡 | sarcopenia 診斷依 EWGSOP2 |
| TUG (Timed Up and Go) | 老年 | 跌倒風險 |

### 3.3 Vitality

| 工具 | 目標族群 |
|---|---|
| ICOPE vitality（體重 –3 kg/3 月 + 食慾下降） | 60+ |
| SARC-F | 老年（肌少症篩檢） |
| MNA-SF | 老年（營養篩檢） |
| Fried Frailty Phenotype | 65+ |

LOINC：未在 LOINC 直接搜尋頁找到 SARC-F 標準 code（[loinc.org](https://loinc.org) 搜尋未列出）。MNA-SF 有部分 panel code，但**未在本次搜尋中取得具體 LOINC 編號**——標註為待確認。

### 3.4 Psychological

| 工具 | 目標族群 | LOINC |
|---|---|---|
| ICOPE 2-item depression（PHQ-2 改寫） | 60+ | — |
| **PHQ-2** | 12+ 通用 | [55757-9 (panel)](https://loinc.org/55757-9)、[55758-7 (total)](https://loinc.org/55758-7)、[58120-7 (CMS variant)](https://loinc.org/58120-7) |
| **PHQ-9** | 12+ 通用 | [44249-1](https://loinc.org/44249-1) |
| **GAD-7** | 18+ | [69737-5 (panel)](https://loinc.org/69737-5/panel)、[70274-6 (total)](https://loinc.org/70274-6) |
| **PHQ-4**（PHQ-2 + GAD-2） | 18+ | [70272-0 (total)](https://loinc.org/70272-0) |
| Perceived Stress Scale (PSS-14) | 18+ | [106904-6](https://loinc.org/106904-6/panel) — 注意 LOINC 收錄的是 14 題版本，不是常用的 PSS-10；PSS-10 LOINC 在本次搜尋未確認 |
| Maslach Burnout Inventory (MBI / MBI-HSS) | 18+（職場） | **未找到官方 LOINC code**；MBI 為 Mind Garden 商業授權量表 |

### 3.5 Sensory

| 工具 | 備註 |
|---|---|
| ICOPE 視/聽自陳題 | 60+ |
| Snellen / LogMAR 視力表 | 全年齡 |
| Whisper test | 床邊聽力篩檢 |
| HHIE-S (Hearing Handicap Inventory for the Elderly – Screening) | 老年 |

---

## 4. WHO IC 是否用於 working-age adults？

**直接答案：WHO 官方文件 IC 框架僅針對 60+ 老年人口。** 但學術界存在向中年延伸的研究（45+），尚未到工作年齡全段（18–64）。

證據：

1. **WHO 官方所有 IC 文件主體都是 ICOPE，標題即「Older People」**，目標族群採 UN 60+ 標準（[WHO ageing Q&A](https://www.who.int/news-room/questions-and-answers/item/population-ageing)）。
2. **未找到任何 WHO、NIH/NIA、NICE、AGS、EuGMS 文件將 IC 概念正式延伸至 18–64**。
3. **Beard 2016 原文是 life-course 框架但 focus 在「second half of life」**（[PMC4848186](https://pmc.ncbi.nlm.nih.gov/articles/PMC4848186/)）。Figure 3 的 IC 軌跡圖確實涵蓋全生命週期，這是 IC 概念可延伸的「概念立足點」，**但不是操作化延伸**。
4. **最早期的成人 IC 驗證：Dunedin Study age 45**（[PMC12760625](https://pmc.ncbi.nlm.nih.gov/articles/PMC12760625/)）— 是**目前最低**的 IC 驗證年齡，仍不到 18-44。研究者自陳：「Currently, the youngest participants in validation studies are 45, and most are over 65.」
5. **INSPIRE-T 自稱「throughout adulthood」**（[Nature Aging 2023](https://www.nature.com/articles/s43587-023-00522-x)），但實際下限仍偏中年。abstract 詳細年齡需付費全文確認。
6. Burnout / 螢幕疲勞 / 注意力 / 工作壓力等指標**完全不在 ICOPE 5 domain 內**。Vitality 指的是營養/體重/食慾，不是「精力下降」的工作年齡意涵。

**結論：宣稱「基於 WHO IC 框架用於 18–64 工作年齡」在學術上是「概念啟發」，不是「官方背書」。** 報告中應誠實說「inspired by WHO IC 5-domain」而非「based on WHO ICOPE」。

---

## 5. 工作年齡成人功能健康的權威框架（IC 不適用時的替代）

| 框架 | 目標年齡 | 內容 | 適合 18–64？ | URL |
|---|---|---|---|---|
| **WHO ICF** | 全年齡 | Body functions/structures、Activities/Participation、Environmental/Personal factors。「ICF-CY 已合併回 ICF」=單一框架涵蓋兒童到老人 | ✅ 是 | [WHO ICF](https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health) |
| **WHO WHODAS 2.0** | 全成人，**ICF-based** | 6 domain：Cognition / Mobility / Self-care / Getting along / Life activities (work & school) / Participation。36-item 或 12-item。複雜計分 0–100（IRT，0=無 disability，100=完全 disability） | ✅ 是，**Life activities 明確含「work & school」** | [WHO WHODAS](https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health/who-disability-assessment-schedule)、[manual](https://www.who.int/publications/i/item/measuring-health-and-disability-manual-for-who-disability-assessment-schedule-(-whodas-2.0)) |
| **NIH PROMIS** | 兒童 + 成人 | ~70 domains：physical / mental / social function、pain、fatigue、depression、anxiety、sleep、cognitive function 等；可用 CAT 或 short form | ✅ 是 | [NIH Common Fund PROMIS](https://commonfund.nih.gov/promis)、[HealthMeasures](https://www.healthmeasures.net/explore-measurement-systems/promis) |
| **SF-36 / RAND-36** | 14+ | 8 個 subscale，含 physical functioning、role limitations、mental health、vitality、social functioning | ✅ 是，但較舊 | — |
| **EQ-5D-5L** | 12+ | 5 domain + VAS，主要用於健康相關生活品質 (HRQoL) | ✅ 是 | EuroQol Group |
| **ICHOM Older Person Standard Set** | 老年 | UCLA-3 Loneliness、SF-36、ASCOT、Zarit Burden、Clinical Frailty Scale | ❌ 老年專用 | [ICHOM Older Person](https://www.ichom.org/patient-centered-outcome-measure/older-person/)、[ICHOM PDF](https://ichom.org/files/articles/Standardsetofhealthoutcomemeasuresforolderpersons.pdf) |

**對 working-age 最強組合**：WHODAS 2.0（功能/失能總分）+ PROMIS short forms（具體 domain 細部）+ SF-36 / EQ-5D（HRQoL）。WHODAS 12-item 約 5 分鐘可完成，適合篩檢層；36-item 約 20 分鐘為深度評估。

---

## 6. 計分與分流規則（ICOPE 官方）

依驗證研究（[PMC10463906 Diagnostic performance analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC10463906/)）：

- **每個 item 為 binary（pass/fail，0/1）**，非 0–100 連續分。
- **總分範圍 0–9**（每個 item 一分）。
- **Cut-off：≥ 1 → possible IC decline → 進入 Step 2**。
- 換言之，**任一 domain 異常 → 轉介 / 進入 in-depth assessment**。這是 sensitivity-first 設計（94.6% sensitivity，62.3% specificity，整體 86.0% diagnostic accuracy）。
- **Step 2 才用各 domain 的標準化工具確認受損嚴重度與是否需 care plan**（Step 3）。

WHO 並未在 Step 1 提供加總式百分位分數。「IC composite score (0-100)」是學術研究的延伸操作化（如 [INSPIRE-T centiles](https://www.nature.com/articles/s43587-023-00522-x)、[ELSA IRT-based](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10061563/)），**不是 WHO 官方分流規則**。

---

## 7. FHIR 映射 / LOINC / ICHOM

### 7.1 ICOPE 本身的 FHIR / LOINC 標準

- **未找到 WHO 官方發布的 ICOPE FHIR Questionnaire 或 LOINC code set**。
- WHO 有 SMART Guidelines 計畫（digital adaptation kits），但 ICOPE 的官方 FHIR IG 截至本次搜尋未發現。

### 7.2 構成 IC 篩檢的個別量表的 LOINC（可組合自建）

| 量表 | LOINC 主要 code | URL |
|---|---|---|
| PHQ-2 | 55757-9 / 55758-7 / 58120-7 | [55757-9](https://loinc.org/55757-9) |
| PHQ-9 | 44249-1 | [44249-1](https://loinc.org/44249-1) |
| PHQ-4 | 70272-0 | [70272-0](https://loinc.org/70272-0) |
| GAD-7 | 69737-5 / 70274-6 | [69737-5](https://loinc.org/69737-5) |
| MoCA | 72133-2 / 72172-0 / LP156676-1 | [72133-2](https://loinc.org/72133-2) |
| Perceived Stress Scale (PSS-14) | 106904-6 | [106904-6](https://loinc.org/106904-6/panel) |
| SARC-F | 未在本次搜尋中找到 LOINC code | — |
| MNA-SF | 未在本次搜尋中找到具體 LOINC code | — |
| MBI (Burnout) | 未找到（商業授權） | — |
| 5x Sit-to-Stand time | 未找到 ICOPE 專用 LOINC，可用 generic functional measure code | — |

### 7.3 ICHOM Older Person Standard Set

- 7 domain：Loneliness (UCLA-3)、Physical Functioning (SF-36)、Mental Health (SF-36)、Vitality (SF-36)、Social Support (ASCOT)、Caregiver Burden (Zarit-4)、Frailty (Canadian Clinical Frailty Scale)。
- 提供 Data Dictionary 與 Reference Guide（需註冊下載）。**未明示 FHIR 對應**，但 ICHOM 一般有 FHIR profiles。
- 來源：[ichom.org Older Person](https://www.ichom.org/patient-centered-outcome-measure/older-person/)、[原始期刊全文 PMC5797357](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5797357/)。
- **不含 SARC-F、PROMIS、EQ-5D、ICECAP**。
- **與 ICOPE/IC 不直接對應**（雖然 SF-36 vitality 與 IC vitality 在語意上接近，但量表完全不同）。

---

## 8. 年齡分段（healthy ageing）

| 分段 | 範圍 | 來源 |
|---|---|---|
| Older people（WHO 統一標準） | **60+** | [WHO Q&A](https://www.who.int/news-room/questions-and-answers/item/population-ageing) |
| Young-old | 65–74 | 學術慣用，常見於老年學文獻 |
| Old-old | 75–84 | 同上 |
| Oldest-old | 85+ | 同上 |
| WHO 另一套（較少用） | elderly 60–75、senile 75–90、long-livers 90+ | 出現於部分 WHO 出版品，**非主流** |

ICOPE 官方文件**沒有採用年齡 sub-strata 的計分差異**。所有 60+ 用同一份 Step 1 工具。延伸到 < 60 的官方建議**不存在**。

---

## 9. 對齊缺口與建議（給 smart-func-cds）

### 9.1 學術/官方支持程度盤點

| 目前 spec 設定 | 官方支持程度 |
|---|---|
| 「WHO Intrinsic Capacity 5-domain 框架」 | ✅ 概念成立（Beard 2016 + Cesari 2018） |
| 「目標族群 18–64 工作年齡」 | ❌ **WHO 官方 ICOPE 僅限 60+**；最早期的成人 IC 驗證是 Dunedin age 45，**沒有任何官方文件覆蓋 18-44** |
| 「填補兒童發展 ↔ 高齡衰弱之間的成人空白」 | ✅ 學術空白確實存在（[Age & Ageing 2024 meta-analysis](https://academic.oup.com/ageing/article/53/7/afae162/7721455) 自陳此一缺口） |
| 「burnout / 螢幕疲勞 / 注意力 / 壓力」對應 IC | ❌ 不在 ICOPE 5 domain 內。Vitality 是營養/體重，非「精力下降」工作概念。Psychological 是 PHQ-2 depression，非 MBI/PSS 工作壓力 |
| Step 1 「任一 domain 異常 → 轉介」 | ✅ 與 WHO 官方計分一致 |
| 「Domain 0–100 加權平均 + 70/40 切點」 | ❌ ICOPE 是每 item binary、總分 0–9、≥1 即轉介；0–100 連續分屬學術研究延伸（INSPIRE-T、ELSA）不是 WHO 官方分流規則 |

### 9.2 戰略取向選項

**選項 A — 對齊 ICOPE、放寬年齡（弱對齊）**
- 直接套 ICOPE 5 domain + Step 1/Step 2 結構，但向下延伸至 18+。
- 在文件中明示：「Framework inspired by WHO ICOPE intrinsic capacity (Beard 2016, Cesari 2018), adapted for 18+ adults; not endorsed by WHO for working-age use.」
- 風險：醫療專業審查時容易被質疑「IC 不是 working-age 工具」。
- 優點：與一個有國際聲量的框架掛勾，五個 domain 的故事性強。

**選項 B — 改採 ICF / WHODAS 2.0 / PROMIS 組合（強對齊）**
- 主框架：**WHO ICF**（全年齡，國際標準）。
- 篩檢：**WHODAS 2.0 12-item**（5 分鐘、6 domain 含 work & school、官方支持 working-age）。
- 深度：**PROMIS short forms / CAT**（physical / mental / social function、burnout 相關 fatigue domain）。
- 工作壓力 / burnout：MBI（注意授權）或 PSS-10 / Copenhagen Burnout Inventory（CBI，公開授權）。
- 優點：每一個元件都有官方背書 + LOINC code，FHIR 化容易。
- 缺點：失去「IC 5-domain 雷達圖」的 storytelling。

**選項 C — 混合（折衷）**
- 框架敘事層：保留 IC 概念與 5-domain 雷達（cognition、locomotion、vitality、psychological、sensory），對使用者好懂、好溝通。
- 評估執行層：**用 working-age 友善的量表取代 ICOPE Step 1 的部分 item**，並用 **LOINC + FHIR Questionnaire** 標準化：
  - Cognition：PROMIS Cognitive Function 或 MoCA（18+ 通用）
  - Locomotion：grip strength + gait speed + 5x STS（移除 ≥14s 老年 cut-off，改為連續分數）
  - Vitality：分裂為 (a) 營養/體重（保留 ICOPE 風格）與 (b) 工作精力/疲勞（PROMIS Fatigue 或 MBI Exhaustion 子量表）
  - Psychological：PHQ-2 → PHQ-9（如異常）+ GAD-7 + PSS-10
  - Sensory：自陳題 + 必要時 Snellen / Whisper test
- 在文件中誠實標註：「This system extends the WHO ICOPE 5-domain conceptual framework (Beard 2016) to working-age adults. The framework is conceptually inspired by WHO ICOPE but uses age-appropriate validated instruments rather than the ICOPE Step 1 screening tool, which is validated only for adults aged 60+.」
- 工作壓力 / burnout / 螢幕疲勞作為 **vitality / psychological domain 的子指標**，明確標示這些**不是 ICOPE 原始項目**而是「working-age extension」。

**選項 D — 重新對齊 ICOPE 原始族群（60+），系統定位調整為老年版 IC CDS**
- 把目標族群由 18-64 改為 60+，完全套用 ICOPE Step 1 9 個 item + Step 2 工具 + binary 計分 + ≥1 即轉介。
- 系統名 `smart-func-cds` 仍貼切（functional health 在老年語境）。
- 優點：100% WHO 對齊、最低臨床審查風險、可直接引用 ICOPE 驗證數據。
- 代價：放棄「兒童↔老年之間的工作年齡空白」原始定位；indicators 中的 burnout / 螢幕疲勞需移除。

### 9.3 FHIR 實作建議

1. **不要自建 ICOPE FHIR Questionnaire**——WHO 沒發布，且 18-64 套用本身已偏離原典。
2. **以 LOINC-coded 個別量表為單位構築 QuestionnaireResponse**：PHQ-2/9、GAD-7、PHQ-4、MoCA、PSS-14 都有 LOINC code（見 §7.2）。
3. **SARC-F / MNA-SF / MBI 沒有官方 LOINC**——使用 Questionnaire 自訂 code + 在 `Questionnaire.code` 留 `system="local"`、`code` 標自家版本號，未來等 LOINC 加入再 migrate。
4. **ICHOM Older Person Set 不適合本系統**（老年專用，且不含 burnout/stress）。

### 9.4 必須在報告/文件中正面處理的張力

- 不要寫「Based on WHO ICOPE」；改寫「**Inspired by WHO's Intrinsic Capacity framework (Beard 2016, Cesari 2018), extended beyond its original 60+ scope.**」
- 在限制章節寫明：「The original ICOPE Step 1 screening tool is validated only in older adults (≥60). The youngest IC validation cohort to date is the Dunedin Study at age 45 (Wallace et al). No published validation exists for IC in adults aged 18-44.」並引 [PMC12760625](https://pmc.ncbi.nlm.nih.gov/articles/PMC12760625/) 與 [Age & Ageing 2024 meta-analysis](https://academic.oup.com/ageing/article/53/7/afae162/7721455)。
- 若要保留「兒童 ↔ 工作年齡 ↔ 高齡」三段定位，建議在 IC 之外**並列引用 WHO ICF**（全年齡、官方背書），作為「跨年齡可比」的母框架。

---

## 主要來源彙整

- WHO ICOPE: <https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/ageing-and-health/integrated-care-for-older-people-icope>
- WHO ICOPE Handbook 2nd ed: <https://www.who.int/publications/b/71300>
- WHO ICF: <https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health>
- WHO WHODAS 2.0: <https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health/who-disability-assessment-schedule>
- WHO WHODAS Manual: <https://www.who.int/publications/i/item/measuring-health-and-disability-manual-for-who-disability-assessment-schedule-(-whodas-2.0)>
- Beard 2016 World Report (PMC): <https://pmc.ncbi.nlm.nih.gov/articles/PMC4848186/>
- Cesari 2018 5-domain evidence: <https://academic.oup.com/biomedgerontology/article/73/12/1653/4834876>
- ICOPE diagnostic performance: <https://pmc.ncbi.nlm.nih.gov/articles/PMC10463906/>
- ICOPE VIMCI 驗證: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9945724/>
- ICOPE Singapore: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10737100/>
- ICOPE Taiwan ICOPES-TW: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11141031/>
- Dunedin midlife IC validation (age 45): <https://pmc.ncbi.nlm.nih.gov/articles/PMC12760625/>
- INSPIRE-T centiles: <https://www.nature.com/articles/s43587-023-00522-x>
- ELSA IRT operationalization: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10061563/>
- Middle-aged IC meta-analysis: <https://academic.oup.com/ageing/article/53/7/afae162/7721455>
- Vitality working definition: <https://www.thelancet.com/journals/lanhl/article/PIIS2666-7568(22)00200-8/fulltext>
- WHO ageing 60+ definition: <https://www.who.int/news-room/questions-and-answers/item/population-ageing>
- NIH PROMIS: <https://commonfund.nih.gov/promis>
- ICHOM Older Person: <https://www.ichom.org/patient-centered-outcome-measure/older-person/>
- ICHOM Older Person paper: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5797357/>
- LOINC PHQ-2: <https://loinc.org/55757-9>
- LOINC PHQ-9: <https://loinc.org/44249-1>
- LOINC GAD-7: <https://loinc.org/69737-5>
- LOINC MoCA: <https://loinc.org/72133-2>
- LOINC PSS-14: <https://loinc.org/106904-6/panel>

---

## 已知無法以官方原文確認的條目（誠實標註）

1. **ICOPE Handbook 2nd ed (2024/2025) 的目標年齡 explicit 下限**：WHO 線上頁面僅稱「older people」，並未列出 explicit ≥60 文字；UN 60+ 標準是 WHO Q&A 的通用定義，而非 Handbook 內條文。
2. **ICOPE Handbook 2nd ed 的 Step 2 工具列表**：官方 PDF（[WHO CDN brochure](https://cdn.who.int/media/docs/default-source/ageing/who-alc-icope-brochure.pdf)、[segg.es Handbook PDF](https://www.segg.es/media/descargas/ICOPE-handbook-2nd-final.pdf)）在本次抓取為 binary，無法解析。報告中 §1.4 的 Step 2 工具來自 peer-reviewed validation 研究，不是 Handbook 原文直引。**實作前應對照官方 Handbook 2nd ed PDF 確認。**
3. **WHO 官方發布的 ICOPE FHIR IG / LOINC code set**：本次搜尋**未找到**。建議用 §7.2 的個別量表 LOINC 自行組裝 Questionnaire。
4. **SARC-F、MNA-SF、MBI 的 LOINC code**：本次搜尋未找到公開正式 code，需於 [loinc.org](https://loinc.org) 進一步個別查詢確認。
