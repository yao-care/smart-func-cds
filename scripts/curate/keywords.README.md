# scripts/curate/keywords.json

成人 IC 衛教影片策展用：為 `func.domain.<domain>.<band>.<ageGroup>` trigger
產出 YouTube 搜尋關鍵字。執行階段啟動前必填，否則 `pnpm curate:videos`
跑完空集合不做事。

## Schema (per trigger)

```json
{
  "<trigger-key>": {
    "primary": ["array<string>", "繁中關鍵字至少 2 組（成人自我照護視角）"],
    "secondary": ["array<string> optional", "英文關鍵字（衛教/醫學視角）"],
    "educationSlug": "string optional：對應 src/data/education/<slug>.md",
    "minDuration": "number：秒數下限",
    "maxDuration": "number：秒數上限",
    "timeSensitive": "boolean：true 則 > 8y 影片 hard reject"
  }
}
```

## Example

```json
{
  "func.domain.vitality.low.18-39": {
    "primary": ["成人 睡眠 衛教 失眠 改善", "睡眠品質 提升 醫師"],
    "secondary": ["adult sleep hygiene insomnia"],
    "educationSlug": "adult-sleep-hygiene",
    "minDuration": 90,
    "maxDuration": 1800,
    "timeSensitive": false
  }
}
```

## Design rules

1. **視角分層**：成人自我照護視角 + 衛教/醫療視角（**非親職/育兒視角**）
2. **中英並用**：primary 繁中 ≥ 2 組，secondary 英文 1 組
3. **語意涵蓋**：功能主題 + 處置/保健詞
4. **對象限定詞**：成人 / 上班族 / 中年 / 長者（依 ageGroup）；**禁用嬰兒/幼兒/學齡前等兒科詞**
5. **禁用詞**：偏方、神奇、秘方、保健品、代購、中醫證型、DIY 治療
6. **`timeSensitive: true`** 條件：時效性指引（一般 IC 衛教多為 evergreen，預設 false）
7. **跨 trigger keywords 避免完全重複**

## 五大功能域 → browse 文章對照

| domain | low band 主文章 | moderate band 主文章 |
|--------|----------------|---------------------|
| vitality | adult-sleep-hygiene | fatigue-management |
| locomotion | physical-activity-benefits | sedentary-harms |
| cognition | cognitive-health | attention-memory-care |
| psychological | understanding-burnout | stress-management |
| sensory | vision-care | hearing-care |
