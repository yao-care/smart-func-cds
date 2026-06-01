# `src/data/` — 內容資料總覽

本目錄存放所有「**內容類資料**」(content data)，與 `src/lib/` 的「行為類程式」(behavior code) 分開。

**核心原則：**
- **內容自身的事實**（文章本文、影片 metadata）→ 按類型分檔（`education/*.md`、`video-catalog/*.yaml`）。
- **內容 ↔ 評估情境的關聯**（哪篇/哪支出現在哪個 域×年齡×嚴重度 / 臨床情境）→ **統一在單一檔 `education/content-relevance.yaml`**。
- markdown 不可含影片欄位（schema 鎖死，見 `education/README.md`）。

## 子目錄總覽

```
src/data/
├── education/                   📄 衛教文章 + 唯一關聯源
│   ├── *.md                     一篇一檔（Astro Content Collection，format='article'）
│   ├── content-relevance.yaml   ★ 唯一關聯源：inapplicable + triggers(videoIds/articles) + clinicalEducation
│   └── README.md                ← 詳細規則
│
├── questionnaire/               📝 成人 IC 指標／問卷
│   └── indicators.yaml          五大域指標、題目、權重、年齡適用性（prebuild 經 validate-indicators 守門）
│
├── video-catalog/               🎬 衛教影片元資料（事實，非關聯）
│   ├── official-tw.yaml         Tier 1 台灣官方
│   ├── international.yaml        Tier 2 國際認證
│   ├── pro-kol.yaml             Tier 3 醫療專業 KOL
│   └── README.md                ← 詳細規則 + 維護流程
│
└── site-faqs.ts                 ❓ 首頁/關於頁 FAQ 文案
```

## 內容類型 vs 維護單位 vs UI 出現位置

| 內容類型 | 事實檔 | 關聯 | UI 出現位置 |
|---------|--------|------|------------|
| 📄 文章 | `education/*.md` | `education/content-relevance.yaml` | `/education/` 矩陣 + `/education/<slug>/` 詳細頁 + 評估結果頁推薦 |
| 🎬 影片 | `video-catalog/<tier>.yaml` | `education/content-relevance.yaml` | `/education/` 矩陣 + 評估結果 / 工作台警示推薦 |
| 📝 IC 指標/問卷 | `questionnaire/indicators.yaml` | — | 評估流程問卷步驟（不在 `/education/`） |

## 三視圖如何用 content-relevance.yaml

由 `scripts/build-content-index.ts` 編譯成 `public/data/video-index.json`（超集），三視圖投影：
- **矩陣瀏覽** `/education/`：該 `域×年齡` 格的 browse 文章 + 影片；`inapplicable` 標「—」。
- **評估後推薦**：異常域 × 年齡 × 分流類別 → 該格 `severities` 命中的文章 + 租戶 overlay。
- **觸發影片 / closed-loop**：trigger → videoIds；指標 → `clinicalEducation`。

## 常見誤會：「衛教影片要寫在哪？」

**絕不寫進 markdown frontmatter**。流程：
1. `pnpm curate:videos`（yt-dlp 抓 metadata）→ 複審後寫進 `video-catalog/<tier>.yaml`
2. 加關聯 → 在 `education/content-relevance.yaml` 對應 trigger 的 `videoIds` 加 videoId
3. `pnpm build`（prebuild 跑 `build-content-index` 重產 `public/data/video-index.json`）
4. `pnpm test`

詳見 `video-catalog/README.md`。

## 為何「關聯統一、事實分檔」

「內容↔情境關聯」統一為單一 `content-relevance.yaml`：改一處、三視圖同步、不會多處登記不一致。**事實資料**仍按類型分檔（影片 metadata vs 文章本文 vs 指標），因為它們量級、變動頻率、自動化來源都不同；但**關聯只有一份**。

## 守護測試

| 測試 | 守護什麼 |
|------|---------|
| `tests/data/education-no-video-fields.test.ts` | markdown 不可含 videoUrl / triggerIndicators / format≠article |
| `tests/data/education-slug-integrity.test.ts` | `content-relevance.yaml` 的 `articles[].slug` 對應 .md 真實存在 |
| `tests/data/trigger-uniqueness.test.ts` | `content-relevance.yaml` trigger key 唯一 |
| `tests/education/content-index-parity.test.ts` | index 行為不變量（含矩陣 educationSlug） |

違反即 build / CI fail。
