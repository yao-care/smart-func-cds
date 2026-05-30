# 衛教內容 — Markdown 文章單一來源

## 用途

每篇 markdown = 一篇衛教**文章**（純文字 / 問卷）。**不放影片資料**。

## Schema

```typescript
{
  title: string;
  summary: string;
  // 成人內在能力（IC）衛教分類，對應五大功能域
  category:
    | 'sleep' | 'fatigue' | 'nutrition'           // 身體活力 vitality
    | 'activity' | 'sedentary'                    // 行動功能 locomotion
    | 'cognition'                                 // 認知功能 cognition
    | 'burnout' | 'stress' | 'mood' | 'wellbeing' // 心理功能 psychological
    | 'vision' | 'hearing' | 'screen'             // 感官功能 sensory
    | 'general';
  ageGroup: ('18-39' | '40-54' | '55-64')[];
  format: 'article';   // ← 不可為 'video' / 'questionnaire'
  publishedAt: Date;
  updatedAt?: Date;
  locale?: string;                       // 預設 'zh-TW'
}
```

## ❌ 禁止欄位

下列欄位**不可**出現在 markdown frontmatter；違反會被 `tests/data/education-no-video-fields.test.ts` 抓到：

- `videoUrl` — 影片網址移到 `src/data/video-catalog/<tier>.yaml`
- `triggerIndicators` — trigger 對應移到 `src/data/education/content-relevance.yaml`
- `format: "video"` — 走 yaml catalog，不存在 markdown 中

## 影片要加在哪裡？

- **影片元資料**（title / channel / duration / sourceTier / score）→ `src/data/video-catalog/<tier>.yaml`
- **影片對應到哪些評估結果**（cdsa.triage.refer.13-24m / cdss.spo2.critical.infant 等）→ `src/data/education/content-relevance.yaml`

詳見 `../video-catalog/README.md`。

## 為什麼分兩套（markdown 文章 / yaml 影片）

歷史上一度有 markdown frontmatter 帶 `videoUrl` 的設計，但發現：

1. Markdown 缺 channel / sourceTier / duration / view count 等影片元資料
2. Markdown 的 `triggerIndicators: ["sugar_intake"]` 只到 indicator 名稱，無法表達完整 `cdss.sugar_intake.critical.preschool` 等 ageGroup × level × indicator
3. 兩套並存時 UI 渲染分岔（縮圖卡 vs 純文字卡）

2026-05-21 統一決策：markdown = 文章；yaml = 影片。**單一資料來源原則**由 schema + test 雙重守護。
