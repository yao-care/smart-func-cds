# Smart Func 成人功能健康評估系統 — 維護指南

開源**成人（18–64 歲）功能健康自評／CDSS**，聚焦 WHO **內在能力（IC）**，採 SMART on FHIR、瀏覽器端、零後端，部署於 GitHub Pages。線上站：https://smart-func-cds.yao.care/（品牌 **Smart Func**）。對外角色稱「受測者」，內容為成人 IC 主題。

## 兩個子系統

1. **成人 IC 評估**（核心）— 引導式問卷＋客觀測驗 → 五大域分級＋分流＋衛教；結果可上傳至**收案點**（醫院 FHIR／GCM）。引擎 `src/engine/func/`，流程 `/assess/`、結果 `/result/`、收案返回 `/launch/`、衛教 `/education/`。
2. **FHIR 臨床監測／閉環** — 生命徵象規則引擎、基線、ML 風險、閉環通知。引擎 `src/engine/`（`risk-analyzer`/`closed-loop`/`workers/`），臨床工作台 `src/components/workspace/`、`dashboard/`。

## 技術棧

Astro 5 SSG ＋ Svelte 5 runes｜CSS Custom Properties + OKLCH（`src/styles/tokens.css`）｜Content Layer + Zod｜IndexedDB via Dexie 4｜D3 子模組｜ONNX Runtime Web (WASM) in Worker｜**FHIR**：fhirclient.js（醫院）＋原生 fetch/`crypto.subtle` PKCE（GCM 收案，`src/lib/fhir/gcm-submit.ts`）｜Pagefind｜jsPDF｜pnpm。

## 強制規則

- **程式碼**：TypeScript strict、不允許 `any`；Svelte 5 runes（`$state`/`$derived`/`$effect`），不用 Svelte 4 store；D3 僅子模組匯入（禁 `import * as d3`）；CSS 色彩用 OKLCH + `@supports` hex fallback；Mermaid 色彩用 hex（非 oklch()）；最小字級 18px（`--text-xs`）、最小觸控目標 44px。
- **安全**：禁硬編碼密碼/Token/密鑰；console.log 禁輸出 PII（姓名、身分證）；PDF 報告僅用 FHIR Patient ID；不使用大陸廠牌 AI。GCM 收案 scope **不帶 `openid`/`fhirUser`**、`aud` 必為 GCM base。
- **架構**：重計算（規則引擎、基線、ML、IC 評分）放 Web Worker，主執行緒只處理 UI 與閉環狀態；多分頁用 BroadcastChannel；離線操作排入 sync queue。
- **內容**：衛教文章 `src/data/education/`（Content Collections，schema 於 `src/content.config.ts`）；IC 指標／問卷 `src/data/questionnaire/indicators.yaml`（prebuild 經 `validate-indicators` 守門）；影片策展 `src/data/video-catalog/`（`pnpm curate:videos`）；trigger↔文章/影片單一真相源 `src/data/education/content-relevance.yaml`；監測規則 YAML 由臨床端在「設定→規則編輯器」存進 IndexedDB（非檔案）；模型 `public/models/*.onnx`、音效 `public/sounds/`。

## 常用指令

```bash
pnpm dev / build / preview    # 開發 / 建置(prebuild 索引+守門, postbuild Pagefind+SEO) / 預覽
pnpm check                    # astro check + svelte-check
pnpm lint / test / test:e2e   # ESLint / Vitest / Playwright
pnpm curate:videos            # 影片策展（需 yt-dlp + Chrome）
pnpm conformance <gcm-base>   # GCM 收案端到端自檢（register→authorize→token→transaction）
```

## 領域常數

- **年齡組**（`src/lib/utils/age-groups.ts`）：`18-39` / `40-54` / `55-64`（55+ 全歸此組；65+ 仍可填，結果頁顯示 advisory）
- **五大域**（`IC_DOMAIN_NAMES`，`src/lib/education/schemas.ts`）：`vitality` 活力 / `locomotion` 行動 / `cognition` 認知 / `psychological` 心理 / `sensory` 感官
- **域分級 band**（`src/engine/func/scorer.ts`）：`high` ≥70 / `moderate` 40–69 / `low` <40
- **分流 triage**（`src/engine/func/triage.ts`）：`normal` / `observe` / `consult` / `incomplete`
- **監測預警**（`tokens.css` 的 `LEVEL_TO_COLOR`）：`normal`→`--accent`、`advisory`／`warning`→`--warn`、`critical`→`--danger`

## 目錄結構

- `src/engine/` 客戶端引擎（`func/`=IC 評估、`workers/`=重計算 Worker）
- `src/lib/` 共用庫（`fhir`/`db`/`stores`/`education`/`seo`/`pdf`/`utils`）；FHIR 收案：`gcm-submit`/`collection-points`/`launch-return`/`cdsa-resources`/`cdsa-submit`
- `src/components/` UI（`assess`/`education`/`workspace`/`dashboard`/`settings`/`fhir`/`ui`…）
- `src/data/` 內容層（`education`/`questionnaire`/`video-catalog`）
- `src/pages/` 路由（`/assess` `/result` `/launch` `/education` `/history` `/workspace` `/settings`）
- `public/models` ONNX、`public/sounds` 音效、`public/data` 建置產出索引

## Island 水合

首屏互動 `client:load`｜捲動觸發 `client:visible`｜低優先 `client:idle`｜純展示零 JS（Astro 元件）。

## 部署

- GitHub Pages（`build_type=workflow`），自訂網域 `smart-func-cds.yao.care`、強制 HTTPS、astro base `/`。
- **push 到 `main` 自動觸發 `deploy.yml`**；需要時可 `gh workflow run deploy.yml --ref main` 手動觸發。
- CI（`ci.yml`）：測試 + content-index 一致性 + Lighthouse（`.lighthouserc.json`，門檻全 warn）。
- 驗站：本機 proxy 會把網域解析成 198.18.x.x 假 IP，一律用 `curl --resolve smart-func-cds.yao.care:443:185.199.108.153 …` 或 DoH，別信本機 dig/curl。
