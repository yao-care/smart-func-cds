import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd(); // vitest 由 repo root 執行
const read = (p: string) => readFileSync(resolve(root, p), 'utf-8');

const BANNED_URL = [/yaocare/, /yao\.care\/smart-pedi-cds/, /smart-pedi-cds/];
// 舊兒科主定位字串（成人 IC 改版後門面層不可再出現）
const BANNED_POSITION = [/臨床決策/, /生命徵象/, /SMART on FHIR/, /兒童發展/, /Smart Pedi/, /里程碑/];

describe('網址一致性', () => {
  const files = [
    'scripts/base.mjs',
    'src/lib/seo/site.ts',
    'src/pages/rss.xml.ts',
    'src/pages/llms.txt.ts',
    'scripts/templates/manifest.template.json',
    'src/data/site-faqs.ts',
  ];
  for (const f of files) {
    it(`${f} 無 yaocare / 舊子路徑`, () => {
      const c = read(f);
      for (const re of BANNED_URL) expect(c).not.toMatch(re);
    });
  }
  it('site.ts repo 指向 yao-care/smart-func-cds', () => {
    expect(read('src/lib/seo/site.ts')).toMatch(/github\.com\/yao-care\/smart-func-cds/);
  });
});

describe('去舊定位（隨每頁渲染或可索引頁）', () => {
  const files = [
    'src/components/blocks/Footer.astro',
    'src/pages/index.astro',
    'src/pages/about.astro',
    'src/pages/rss.xml.ts',
    'scripts/templates/manifest.template.json',
    'scripts/base.mjs',
    'src/lib/seo/site.ts',
  ];
  for (const f of files) {
    it(`${f} 無舊定位字串`, () => {
      const c = read(f);
      for (const re of BANNED_POSITION) expect(c).not.toMatch(re);
    });
  }
});

describe('manifest 品牌一致', () => {
  it('template 用佔位符、無 CDSA', () => {
    const c = read('scripts/templates/manifest.template.json');
    expect(c).toMatch(/__NAME__/);
    expect(c).not.toMatch(/CDSA/);
  });
});
