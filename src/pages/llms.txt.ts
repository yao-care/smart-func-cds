import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../lib/seo/site';
import { CORE_ARTICLE_SLUGS } from '../lib/education/core-articles';

export async function GET(context: APIContext) {
  const site = context.site!;
  const abs = (p: string) => new URL(p, site).href;
  // 只列系統核心文章（五大內在能力面向主衛教），不對外曝光孤兒食譜/補充類
  const coreSet = new Set(CORE_ARTICLE_SLUGS);
  const education = (await getCollection('education')).filter((e) => coreSet.has(e.id));
  const topics = education
    .map((e) => `- [${e.data.title}](${abs(`/education/${e.id}/`)}): ${e.data.summary}`)
    .join('\n');

  const body = `# ${SITE.name}

> ${SITE.tagline}，在瀏覽器完成、不上傳個資。
> 依世界衛生組織內在能力（IC）框架，評估身體活力、行動功能、認知功能、心理功能、感官功能五大面向，並提供對應衛教內容。

## 這是什麼
- 成人可自行操作的功能健康評估，依年齡給適齡題目
- 結果非醫療診斷，發現疑慮建議諮詢醫師
- 由 ${SITE.organization.name} 開發，開源、純瀏覽器、零個資上傳

## 衛教主題
${topics}

## 開始評估
- [成人評估入口](${abs('/assess/')})
- [衛教內容](${abs('/education/')})
- [內容更新 RSS](${abs('/rss.xml')})

## 原始碼
${SITE.repo}
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
