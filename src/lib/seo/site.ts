import {
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
} from '../../../scripts/base.mjs';

export const SITE = {
  name: SITE_NAME,
  shortName: SITE_SHORT_NAME,
  tagline: SITE_TAGLINE,
  description: SITE_DESCRIPTION,
  inLanguage: 'zh-TW',
  logoPath: '/icons/icon-512.png',
  ogImagePath: '/og/og-default.png',
  organization: {
    name: 'yao.care 藥提醒科技',
    legalName: 'yao.care 藥提醒科技',
    url: 'https://yao.care',
  },
  repo: 'https://github.com/yao-care/smart-func-cds',
  sameAs: [] as string[],
} as const;
