/**
 * 本機 CSP 驗證伺服器 —— 複刻 src/index.js 的標頭邏輯，serve dist/，
 * 用來在不動 Cloudflare 的情況下測試新 CSP 是否會打掛 app（內聯 script/style 水合）。
 *
 * 用法：pnpm build 後 → node infra/security-headers-worker/local-verify.mjs
 *       開 http://localhost:8788/ 或用 Playwright 載入並觀察 console 是否有 CSP 違規。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../../dist/', import.meta.url).pathname;
const PORT = 8788;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.xml': 'application/xml',
  '.txt': 'text/plain', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json',
};

const STATIC_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'accelerometer=(), autoplay=(self), camera=(), microphone=(self), fullscreen=(self), geolocation=(), payment=()',
};
const CSP_HEADER_ONLY = "frame-ancestors 'none'; style-src-attr 'unsafe-inline'";
const META_CSP_RE = /<meta http-equiv="content-security-policy" content="([^"]*)">/i;

async function resolveFile(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = clean.endsWith('/')
    ? [join(DIST, clean, 'index.html')]
    : [join(DIST, clean), join(DIST, clean, 'index.html'), join(DIST, clean + '.html')];
  for (const c of candidates) {
    try { return { body: await readFile(c), ext: extname(c) || '.html' }; } catch { /* try next */ }
  }
  return null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  const file = await resolveFile(pathname === '/' ? '/index.html' : pathname);
  if (!file) { res.writeHead(404).end('Not found'); return; }

  const headers = { 'Content-Type': MIME[file.ext] || 'application/octet-stream', ...STATIC_HEADERS };

  if (file.ext === '.html') {
    let html = file.body.toString('utf-8');
    const m = html.match(META_CSP_RE);
    let csp = "default-src 'self'";
    if (m) { csp = m[1].trim().replace(/;\s*$/, ''); html = html.replace(m[0], ''); }
    headers['Content-Security-Policy'] = `${csp}; ${CSP_HEADER_ONLY}`;
    res.writeHead(200, headers).end(html);
  } else {
    headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'";
    res.writeHead(200, headers).end(file.body);
  }
}).listen(PORT, () => console.log(`local-verify serving dist/ on http://localhost:${PORT}`));
