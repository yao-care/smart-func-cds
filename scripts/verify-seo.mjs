import { readFile, access, readdir } from 'fs/promises';
import { resolve } from 'path';

const dist = resolve(process.cwd(), 'dist');
let failed = false;
const ok = (m) => console.log('✓', m);
const fail = (m) => { console.error('✗', m); failed = true; };
const exists = (p) => access(resolve(dist, p)).then(() => true).catch(() => false);

// robots.txt 含 Sitemap
const robots = await readFile(resolve(dist, 'robots.txt'), 'utf-8').catch(() => '');
robots.includes('Sitemap:') ? ok('robots.txt 含 Sitemap') : fail('robots.txt 缺 Sitemap 行');

// llms.txt 網域正確、無 yaocare
const llms = await readFile(resolve(dist, 'llms.txt'), 'utf-8').catch(() => '');
(llms.includes('smart-func-cds.yao.care') && !llms.includes('yaocare'))
  ? ok('llms.txt 網域正確') : fail('llms.txt 網域錯誤或含 yaocare');

// 404.html 存在
(await exists('404.html')) ? ok('404.html 存在') : fail('404.html 缺');

// sitemap 不含 noindex 路徑
const sm = await readFile(resolve(dist, 'sitemap-0.xml'), 'utf-8').catch(() => '');
/\/(settings|admin|result|workspace|history|search)\//.test(sm)
  ? fail('sitemap 含 noindex 路徑') : ok('sitemap 無 noindex 路徑');

// 每篇衛教文章有 h1（遞迴掃 dist/education 下所有 index.html）
async function findIndexHtml(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...(await findIndexHtml(full)));
    else if (e.name === 'index.html') out.push(full);
  }
  return out;
}
const eduHtmls = await findIndexHtml(resolve(dist, 'education'));
let missingH1 = 0;
for (const f of eduHtmls) {
  const html = await readFile(f, 'utf-8').catch(() => '');
  if (html && !html.includes('<h1')) missingH1++;
}
if (eduHtmls.length === 0) { fail('衛教目錄未產出任何頁面'); }
else if (missingH1 > 0) { fail(`${missingH1}/${eduHtmls.length} 衛教頁缺 h1`); }
else { ok(`衛教頁皆有 h1（${eduHtmls.length} 頁）`); }

// noindex 頁不進 Pagefind（settings 為代表）
const settings = await readFile(resolve(dist, 'settings/index.html'), 'utf-8').catch(() => '');
if (!settings) { fail('settings/index.html 不存在'); }
else if (settings.includes('data-pagefind-body')) { fail('settings 仍含 data-pagefind-body'); }
else { ok('settings 已排除 Pagefind'); }

if (failed) {
  console.error('\nSEO 建置後守門失敗。');
  process.exit(1);
}
console.log('\nSEO 建置後守門全數通過。');
