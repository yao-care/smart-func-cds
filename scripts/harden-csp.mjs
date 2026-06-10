/**
 * postbuild：把 style-src-attr 'unsafe-inline' 注入每頁的 CSP meta。
 *
 * 為什麼需要：Astro security.csp 產生的 style-src 只含雜湊（無 unsafe-inline，這正是 ZAP 要的），
 * 但 assess/result/history 有大量 Svelte 動態 style="" 屬性。內聯 style 屬性無法用雜湊授權、
 * 會 fallback 到 style-src 而被擋。style-src-attr 是獨立指令（ZAP 只檢查 style-src，不誤報），
 * 用 'unsafe-inline' 放行純 CSS 的 style 屬性（非 JS 執行向量）。
 *
 * Astro 的 directive 白名單不含 style-src-attr，故無法在 astro.config 設定，於此 postbuild 注入。
 * 注入後 meta CSP 即可自給自足：即使尚未經 Cloudflare Worker，GitHub Pages 單獨上線也不破壞畫面。
 * （frame-ancestors / CORS / 其餘安全標頭仍由 Worker 於標頭層補上。）
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const META_RE = /(<meta http-equiv="content-security-policy" content=")([^"]*)(">)/i;
const ATTR_DIRECTIVE = "style-src-attr 'unsafe-inline'";

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

let patched = 0;
let skipped = 0;
for (const file of await walk(dist)) {
  const html = await readFile(file, 'utf-8');
  const m = html.match(META_RE);
  if (!m) { skipped++; continue; }
  if (m[2].includes('style-src-attr')) { skipped++; continue; }
  const content = m[2].replace(/;\s*$/, '');
  const next = html.replace(META_RE, `$1${content};${ATTR_DIRECTIVE}$3`);
  await writeFile(file, next, 'utf-8');
  patched++;
}

console.log(`harden-csp：已注入 style-src-attr 至 ${patched} 頁（略過 ${skipped} 頁無 CSP meta）`);
if (patched === 0) {
  console.error('harden-csp：未注入任何頁面，CSP meta 可能未產生，請檢查 astro.config security.csp。');
  process.exit(1);
}
