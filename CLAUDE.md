# Smart Func 成人功能健康評估系統 — 開發規則

## 專案概述

開源**成人功能健康自評／臨床決策輔助系統（CDSS）**，聚焦世界衛生組織提出的
**內在能力（Intrinsic Capacity, IC）** 框架，以 SMART on FHIR 標準運行於瀏覽器端。
給 18–64 歲成人使用，部署於 GitHub Pages，零後端，所有邏輯在瀏覽器執行。
線上站：https://smart-func-cds.yao.care/（品牌名 **Smart Func**）。

本 repo 從兒科 `smart-pedi-cds` fork 而來，已全面成人化。**禁止再出現任何兒童／兒科／家長相關字眼**（嬰兒、幼兒、學齡前、兒童、小孩、家長、pediatric…）；對外角色一律稱「受測者」。

## 系統組成（兩個子系統）

1. **成人 IC 功能評估**（核心）— 引導式問卷 + 客觀測驗 → 五大功能域分級 + 分流 + 衛教建議。
   引擎在 `src/engine/func/`，評估流程在 `/assess/`，衛教在 `/education/`。
2. **FHIR 臨床監測／閉環**（保留自原架構）— 生命徵象規則引擎、基線、ML 風險分析、閉環通知。
   引擎在 `src/engine/`（`risk-analyzer`、`closed-loop`、`workers/`），臨床工作台在 `src/components/workspace/`、`dashboard/`。

## 技術棧

- **框架**: Astro 5 SSG + Svelte 5 (runes)
- **樣式**: CSS Custom Properties + OKLCH (`src/styles/tokens.css`)
- **內容**: Astro Content Layer API + Zod
- **資料庫**: IndexedDB via Dexie.js 4.x（瀏覽器端）
- **圖表**: D3 子模組（禁止整包 `d3`）
- **ML**: ONNX Runtime Web (WASM) in Web Worker
- **FHIR**: fhirclient.js
- **搜尋**: Pagefind
- **PDF**: jsPDF
- **套件管理**: pnpm

## 強制規則

### 程式碼

- TypeScript strict mode，不允許 `any`
- Svelte 5 runes（`$state`, `$derived`, `$effect`），不用 Svelte 4 stores
- D3 僅允許子模組匯入（`d3-scale`, `d3-shape` 等），禁止 `import * as d3`
- CSS 色彩用 OKLCH + `@supports` hex fallback
- Mermaid 圖表色彩用 hex，不用 oklch()
- 最小字級 18px（`--text-xs`）
- 最小觸控目標 44px

### 安全

- 禁止硬編碼密碼/Token/密鑰
- console.log 禁止輸出 PII（姓名、身分證）
- PDF 報告僅使用 FHIR Patient ID
- 不使用大陸廠牌 AI 服務

### 架構

- 重計算（規則引擎、基線、ML、IC 評分）放 Web Worker
- 主執行緒僅處理 UI 和閉環狀態
- 多分頁用 BroadcastChannel API 協調
- 離線操作排入 sync queue

### 內容

- 衛教內容放 `src/data/education/`（Content Collections，`src/content.config.ts` 定 schema）
- IC 指標／問卷放 `src/data/questionnaire/`（`indicators.yaml`，prebuild 經 `validate-indicators` 守門）
- 衛教影片策展放 `src/data/video-catalog/`（YAML）
- 監測規則 YAML 由臨床端在「設定 → 規則編輯器」維護並存進 IndexedDB（不是檔案）
- 基線／ML 模型：`public/models/*.onnx`；音效：`public/sounds/`

## 常用指令

```bash
pnpm dev          # 開發伺服器（predev 重建 content/questionnaire 索引）
pnpm build        # 建置（prebuild 跑 content-index + validate-indicators + applicability；後接 Pagefind + SEO 守門）
pnpm check        # Astro check + svelte-check
pnpm lint         # ESLint
pnpm test         # Vitest
pnpm test:e2e     # Playwright
```

## 成人年齡分組

| 分組鍵 | 範圍 |
|--------|------|
| `18-39` | 18–39 歲 |
| `40-54` | 40–54 歲 |
| `55-64` | 55–64 歲（55+ 全歸此組；65+ 仍可填，結果頁顯示 advisory） |

定義於 `src/lib/utils/age-groups.ts`（`AGE_GROUPS_ADULT` / `AGE_GROUP_LABELS`）。

## 五大功能域（IC domains）

`vitality`（身體活力）、`locomotion`（行動）、`cognition`（認知）、`psychological`（心理）、`sensory`（感官）。
定義於 `IC_DOMAIN_NAMES`。

## IC 分級與分流

- **域分級 band**：`high` ≥70 / `moderate` 40–69 / `low` <40（`src/engine/func/scorer.ts`）
- **分流類別 triage**：`normal` / `observe` / `consult` / `incomplete`（`src/engine/func/triage.ts`）

## 監測預警等級（FHIR 子系統）

| 等級 | 代碼 | CSS Token |
|------|------|-----------|
| 正常 | normal | `--accent` |
| 注意 | advisory | `--warn` |
| 警告 | warning | `--warn` |
| 危急 | critical | `--danger` |

（token 定義於 `src/styles/tokens.css`，對應 `LEVEL_TO_COLOR`。）

## 目錄結構重點

- `src/engine/` — 客戶端引擎（非 UI）；`func/` 為 IC 評估，`workers/` 為重計算 Worker
- `src/lib/` — 共用函式庫（`fhir`, `db`, `stores`, `education`, `seo`, `pdf`, `utils`）
- `src/components/` — UI 元件（`assess`, `education`, `patient`, `workspace`, `dashboard`, `settings`, `alerts`, `ui`…）
- `src/data/` — Content Layer 資料（`education/`, `questionnaire/`, `video-catalog/`）
- `src/pages/` — Astro 頁面路由（`/assess/`, `/education/`…）
- `src/layouts/` — 頁面佈局
- `public/models/` — ONNX 模型
- `public/sounds/` — 音效檔案
- `public/data/` — 建置產出的索引（`video-index.json`）

## Island 水合策略

- 首屏互動: `client:load`
- 捲動觸發: `client:visible`
- 低優先: `client:idle`
- 純展示: 零 JS（Astro 元件）

## 部署注意

- fork 的 push event 不自動觸發 Actions，每次發版需 `gh workflow run deploy.yml --ref main` 手動 dispatch
- 本機 proxy 會把網域解析成 198.18.x.x 假 IP，驗站一律
  `curl --resolve smart-func-cds.yao.care:443:185.199.108.153 …` 或 DoH
