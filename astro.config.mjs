import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BASE_PATH } from './scripts/base.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: 'https://smart-func-cds.yao.care',
  base: BASE_PATH || '/',
  integrations: [
    svelte(),
    sitemap({
      filter: (page) =>
        !/\/(settings|admin|result|workspace|history|search)(\/|$)/.test(page) &&
        !page.includes('/about/illustration-credits') &&
        !page.endsWith('/404/'),
    }),
  ],
  output: 'static',
  // 安全標頭策略：Astro 於建置期為每頁內聯 script/style 產生雜湊，輸出 <meta http-equiv> CSP。
  // Cloudflare Worker（infra/security-headers-worker）再把該 CSP 升級為真正的回應標頭並補上
  // frame-ancestors / X-Frame-Options / COOP / Permissions-Policy 等只能走標頭層的指令。
  // 細節：
  //  - script-src：'self' + 'wasm-unsafe-eval'(ONNX) + Astro 雜湊（無 unsafe-inline）
  //  - style-src：'self' + Astro 雜湊（無 unsafe-inline）；style-src-attr 'unsafe-inline' 放行
  //    assess/result/history 的 Svelte 動態 style="" 屬性（純 CSS、非 JS 向量，ZAP 僅檢查 style-src）
  //  - connect-src：'self' https: blob: —— SMART-on-FHIR 醫院 base 與 GCM 收案 base 為使用者動態設定
  //  - frame-src：YouTube 教學影片；worker-src/media-src blob: —— Web Worker 與音效
  security: {
    csp: {
      algorithm: 'SHA-256',
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
      styleDirective: { resources: ["'self'"] },
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "img-src 'self' data: blob: https://i.ytimg.com",
        "font-src 'self'",
        "connect-src 'self' https: blob:",
        "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
        "worker-src 'self' blob:",
        "media-src 'self' blob:",
        "manifest-src 'self'",
        "form-action 'self'",
        // 註：style-src-attr 'unsafe-inline'（放行動態 style="" 屬性）與 frame-ancestors 'none'
        // 不在 Astro 允許清單／在 meta 會被忽略，改由 Worker 於組成最終 CSP 標頭時附加。
      ],
    },
  },
  vite: {
    resolve: {
      alias: {
        '$lib': path.resolve(__dirname, './src/lib'),
      },
    },
    worker: {
      format: 'es',
    },
  },
});
