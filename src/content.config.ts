import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ---------- education collection (glob loader, markdown) ----------
// Education markdown 為「純文章衛教」的單一來源。
// 影片資料（含 videoUrl / channel / trigger 對應）全部走 src/data/video-catalog/*.yaml
// 與 src/data/education/content-relevance.yaml — schema 已禁止 markdown 再帶 video 欄位
// 與 format='video'，防止雙資料來源死灰復燃。
const educationCollection = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/README.md'], base: './src/data/education' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.enum([
      // 成人內在能力（IC）衛教分類，對應五大功能域之評估主題
      'sleep', 'fatigue', 'nutrition',        // 身體活力 vitality
      'activity', 'sedentary',                // 行動功能 locomotion
      'cognition',                            // 認知功能 cognition
      'burnout', 'stress', 'mood', 'wellbeing', // 心理功能 psychological
      'vision', 'hearing', 'screen',          // 感官功能 sensory
      'general',
    ]),
    ageGroup: z.array(
      z.enum(['18-39', '40-54', '55-64']),
    ),
    format: z.literal('article'),  // 移除 'video' / 'questionnaire' — 影片走 yaml catalog；CDSA 評估問卷在 /（不在衛教頁）
    // videoUrl / triggerIndicators 刻意不在 schema 中；任何 markdown 帶這兩個欄位
    // 將被 Astro Content Layer 視為 strict-mode 警告並被忽略。Build 不會 fail
    // 但 schema test 會抓到（見 tests/data/education-no-video-fields.test.ts）。
    publishedAt: z.date(),
    updatedAt: z.date().optional(),
    locale: z.string().default('zh-TW'),
  }),
});

// ---------- export ----------
export const collections = {
  education: educationCollection,
};
