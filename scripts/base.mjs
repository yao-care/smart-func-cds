// Single source of truth for build-time constants.
// Imported by astro.config.mjs, build-sw.mjs, build-manifest.mjs.
// Must remain pure constants — no Astro-only logic.
//
// BASE_PATH = '' (empty) — site is hosted at root of smart-func-cds.yao.care.
// Previously '/smart-func-cds' when served from yao-care.github.io/smart-func-cds/.
export const BASE_PATH = '';
export const THEME_COLOR = '#3d6b54'; // matches tokens.css --color-accent hex fallback (deep eucalyptus, hue 155)

// 品牌字串真相源（跨 build/runtime）。site.ts 匯入後組成 SITE。
export const SITE_NAME = 'Smart Func 成人功能健康評估';
export const SITE_SHORT_NAME = 'Smart Func';
export const SITE_TAGLINE = '給 18–64 歲成人的免費內在能力（IC）自評工具';
export const SITE_DESCRIPTION = '在瀏覽器完成的成人功能健康評估，依世界衛生組織內在能力（IC）框架評估身體活力、行動功能、認知功能、心理功能、感官功能五大面向，並提供對應衛教內容。結果非醫療診斷，發現疑慮建議諮詢醫師。';
