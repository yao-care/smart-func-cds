# Smart Func — 成人功能健康評估系統

開源的**成人（18–64 歲）功能健康自評／臨床決策輔助系統（CDSS）**，聚焦 WHO **內在能力（Intrinsic Capacity, IC）** 框架。採 SMART on FHIR 標準、**純瀏覽器端、零後端**，部署於 GitHub Pages。

線上站：<https://smart-func-cds.yao.care/>

> 對外角色稱「**受測者**」；問卷／衛教／文案皆為成人 IC 主題。

## 系統做什麼

兩個子系統共用同一個瀏覽器端 App：

1. **成人 IC 評估**（核心）：引導式問卷＋客觀測驗 → 五大功能域分級＋分流建議＋衛教推薦。受測者可把結果上傳到**收案點**（醫院 FHIR Server 或 GCM 協會），走標準 SMART on FHIR。
2. **FHIR 臨床監測／閉環**：生命徵象規則引擎、基線、ONNX ML 風險分析、閉環通知，供臨床端使用（工作台 `/workspace/`、`dashboard/`）。

資料預設只存在瀏覽器 IndexedDB；只有受測者主動選擇上傳時，才送往收案點 FHIR Server。

## 技術棧

| 元件 | 技術 |
|------|------|
| 框架 | [Astro 5](https://astro.build/) SSG（`base = /`） |
| 互動元件 | [Svelte 5](https://svelte.dev/) runes（`$state`/`$derived`/`$effect`） |
| 樣式 | CSS Custom Properties + OKLCH（`src/styles/tokens.css`） |
| 內容 | Astro Content Layer + Zod（`src/content.config.ts`） |
| 資料庫 | IndexedDB via [Dexie.js 4](https://dexie.org/)（`src/lib/db/`） |
| 圖表 | D3 子模組（**禁止** `import * as d3`） |
| ML | [ONNX Runtime Web](https://onnxruntime.ai/)（WASM，跑在 Web Worker） |
| FHIR | [fhirclient.js](https://docs.smarthealthit.org/client-js/)（醫院）＋原生 `fetch`/PKCE（GCM 收案） |
| 搜尋 / PDF | [Pagefind](https://pagefind.app/) / jsPDF |
| 套件管理 / 部署 | pnpm / GitHub Pages + Actions |

## 快速開始

```bash
pnpm install
pnpm dev        # http://localhost:4321/ （predev 會先重建 content/questionnaire 索引）
pnpm build      # prebuild 索引+守門 → astro build → postbuild Pagefind+SEO 守門
pnpm preview    # 本機預覽 dist/
```

開發前先讀根目錄 `CLAUDE.md`（強制規則：TS strict 無 `any`、Svelte 5 runes、D3 子模組、OKLCH、字級 18px／觸控 44px、安全與架構規範）。

## 專案結構

```
src/
├── engine/              # 客戶端引擎（非 UI）
│   ├── func/            # ★ IC 評估：scorer / triage / questionnaire / objective-tests / recommendations
│   └── workers/         # 重計算 Web Workers（規則引擎、基線、ML 推論）
├── lib/
│   ├── fhir/            # SMART on FHIR：client/launch（醫院）、cdsa-resources/submit（資源產生）
│   │                    #   gcm-submit / collection-points / launch-return（GCM 收案點）
│   ├── db/              # IndexedDB DAO（Dexie schema 在 db/schema.ts）
│   ├── stores/          # Svelte 5 runes stores（assessment、auth…）
│   ├── education/       # 衛教/影片 schema 與 runtime 索引
│   └── utils/           # age-groups、loinc-map…
├── components/          # UI：assess / education / workspace / dashboard / settings / fhir / ui …
├── data/                # 內容層：education（文章）/ questionnaire（indicators.yaml）/ video-catalog
├── pages/               # 路由：/assess /result /launch /education /history /workspace /settings
├── layouts/  └ styles/  # 佈局 / 設計系統（OKLCH tokens）
public/                  # models/*.onnx（ML）、sounds/（音效）、data/（建置產出索引）
scripts/                 # build-content-index / validate-indicators / curate-videos / gcm-conformance …
```

## 維護指引（依任務查）

| 我要改… | 動哪裡 | 注意 |
|---------|--------|------|
| **衛教文章** | `src/data/education/*.md`（frontmatter 須過 `content.config.ts` schema） | 成人 IC 主題 |
| **IC 指標／問卷** | `src/data/questionnaire/indicators.yaml` | prebuild 經 `validate-indicators` 守門，改完跑 `pnpm build` 驗證 |
| **衛教影片策展** | `pnpm curate:videos`（yt-dlp 取真實 metadata → 報告複審 → 寫 `video-catalog/`） | 需 yt-dlp + Chrome；channel-seeds/keywords 在 `scripts/curate/` |
| **trigger ↔ 文章/影片對照** | `src/data/education/content-relevance.yaml`（單一真相源） | 改完 `pnpm build:video-index` |
| **監測規則（閾值）** | **不在檔案**：臨床端於「設定 → 規則編輯器」維護，存進 IndexedDB | — |
| **ML 模型** | 設定頁上傳新 `.onnx`（即時替換），或放 `public/models/` | — |
| **收案點 / FHIR 上傳** | 見下節 | — |

### 收案點與 FHIR 上傳

結果頁（in-flow `ResultView` 與獨立 `/result/?id=` 的 `ResultViewWrapper`）都提供 `CollectionPointPicker`，受測者可選：

- **醫院 FHIR Server**：手動填 Server URL + Client ID（fhirclient.js，standalone SMART launch）。
- **GCM 預防醫學發展協會**（`https://gcm.fhir.yao.care`）：填暱稱即可，免事先設定。用原生 `fetch` + `crypto.subtle` 做 PKCE/動態註冊（要帶自訂 `login_hint`/`nickname`），模組 `src/lib/fhir/gcm-submit.ts`。

兩條流程都導向統一的 **`/launch/`** 返回頁（`LaunchReturn.svelte` + 純函式 `launch-return.ts` 分流：GCM 優先、否則 fhirclient callback）。跨 redirect 在 sessionStorage 只存 `assessmentId`，返回頁再從 IndexedDB 重建 Observation/DiagnosticReport（`cdsa-resources.ts`，`CODE_SYSTEM = https://smart-func-cds.yao.care/code`）。

收案點清單為 typed 常數（`collection-points.ts`），新增機構在此加一條。

驗證 GCM 端到端（對線上實例）：

```bash
pnpm conformance https://gcm.fhir.yao.care   # register→authorize→token→transaction，斷言 POST / (application/fhir+json) → 200
```

> GCM 注意事項：scope **不帶** `openid`/`fhirUser`、`aud` 必為 GCM base、不自組 Patient（身分＝瀏覽器碼＋暱稱）、`redirect_uri` 三處（register/authorize/token）逐字一致。傳給 IndexedDB 的 `triageResult` 須 `$state.snapshot()` 解包（proxy 無法結構化複製）。

## 領域常數速查

- **年齡組**：`18-39` / `40-54` / `55-64`（55+ 全歸此組；65+ 可填，結果頁 advisory）
- **五大域**：vitality 活力 / locomotion 行動 / cognition 認知 / psychological 心理 / sensory 感官
- **域分級**：`high` ≥70 / `moderate` 40–69 / `low` <40
- **分流**：`normal` / `observe` / `consult` / `incomplete`
- **監測預警**：`normal` / `advisory` / `warning` / `critical`

## 測試

```bash
pnpm test       # Vitest（單元 + 元件，jsdom + fake-indexeddb）
pnpm test:e2e   # Playwright
pnpm check      # astro check + svelte-check（型別）
pnpm lint       # ESLint
```

## 部署

- **push 到 `main` 自動觸發 `deploy.yml`**（GitHub Pages，`build_type=workflow`，自訂網域 + 強制 HTTPS）。需要時可 `gh workflow run deploy.yml --ref main` 手動觸發。
- CI（`ci.yml`）：測試 + content-index 一致性 + Lighthouse（門檻全 warn）。
- **驗站**：本機 proxy 會把網域解析成 198.18.x.x 假 IP — 一律用
  `curl --resolve smart-func-cds.yao.care:443:185.199.108.153 https://smart-func-cds.yao.care/…` 或 DoH，別信本機 dig/curl。

## 授權

MIT License
