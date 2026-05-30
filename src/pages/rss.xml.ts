import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../lib/seo/site';
import { CORE_ARTICLE_SLUGS } from '../lib/education/core-articles';

export async function GET(context: APIContext) {
  // 只列系統核心文章（五大內在能力面向主衛教），不對外曝光孤兒食譜/補充類
  const coreSet = new Set(CORE_ARTICLE_SLUGS);
  const education = (await getCollection('education')).filter((e) => coreSet.has(e.id));
  return rss({
    title: `${SITE.name} — 衛教內容`,
    description: SITE.description,
    site: context.site!.toString(),
    items: education.map((entry) => ({
      title: entry.data.title,
      description: entry.data.summary,
      pubDate: entry.data.publishedAt,
      link: `/education/${entry.id}/`,
    })),
    customData: '<language>zh-TW</language>',
  });
}
