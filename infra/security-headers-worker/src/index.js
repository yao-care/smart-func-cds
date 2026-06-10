/**
 * Smart Func — 安全標頭前置代理 Worker
 *
 * 背景：站台為 Astro SSG，部署於 GitHub Pages。GitHub Pages 無法自訂回應標頭，
 * 因此把網域 proxy 過 Cloudflare，由本 Worker 在邊緣注入安全標頭，關閉 ZAP 掃描
 * 回報的 clickjacking / CORS / 缺漏安全標頭，並把 Astro 於建置期產生的「每頁 CSP
 * meta（含 script/style 雜湊）」升級為真正的 Content-Security-Policy 回應標頭。
 *
 * 流程：
 *   1. fetch(request) → 取得 GitHub Pages 原始回應（同網域子請求會直達 origin，不回圈）。
 *   2. HTML：擷取 <meta http-equiv="content-security-policy"> 的內容 → 附加只能在標頭層
 *      生效的 frame-ancestors / style-src-attr → 設為 CSP 標頭 → 從 HTML 移除該 meta
 *      （改以單一標頭 CSP 為準，避免 meta 的 style-src 反而擋掉動態 style="" 屬性）。
 *   3. 全部回應：移除 GitHub 寬鬆的 Access-Control-Allow-Origin: *，補上 XFO/XCTO/
 *      COOP/Referrer-Policy/Permissions-Policy。
 *
 * 設計取捨：
 *   - script-src：Astro 雜湊 + 'self' + 'wasm-unsafe-eval'（ONNX）；無 unsafe-inline。
 *   - style-src：Astro 雜湊 + 'self'；無 unsafe-inline（ZAP 僅檢查 style-src）。
 *   - style-src-attr 'unsafe-inline'：放行 assess/result/history 的 Svelte 動態 style=""
 *     屬性（純 CSS、非 JS 執行向量）。
 *   - connect-src 'self' https: blob:：SMART-on-FHIR 醫院 base 與 GCM 收案 base 為使用者
 *     動態設定，無法事先白名單；https: 非 ZAP 的 wildcard(*) 違規。
 *   - COEP 故意不設：require-corp/credentialless 會打掛 YouTube 教學影片與第三方資源，
 *     且僅為 ZAP LOW 等級資訊；如未來啟用 ONNX 多執行緒(SharedArrayBuffer)再評估。
 */

const STATIC_SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'accelerometer=()',
    'autoplay=(self)',
    'camera=()',
    'display-capture=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=(self)',
    'midi=()',
    'payment=()',
    'usb=()',
    'browsing-topics=()',
  ].join(', '),
};

// 只能在標頭層生效（meta 會被瀏覽器忽略 / 不在 Astro 允許清單）的 CSP 指令。
const CSP_HEADER_ONLY = "frame-ancestors 'none'; style-src-attr 'unsafe-inline'";

// 非 HTML（sitemap.xml / robots.txt / 資源檔）直接套用的基準 CSP。
const CSP_NON_HTML = "default-src 'none'; frame-ancestors 'none'";

const META_CSP_RE = /<meta http-equiv="content-security-policy" content="([^"]*)">/i;

export default {
  /**
   * @param {Request} request
   */
  async fetch(request) {
    const originResp = await fetch(request);
    const contentType = originResp.headers.get('content-type') || '';
    const headers = new Headers(originResp.headers);

    // GitHub Pages 對靜態資源固定回傳 ACAO: *；移除以關閉 ZAP CORS 寬鬆設定發現。
    headers.delete('Access-Control-Allow-Origin');
    headers.delete('Access-Control-Allow-Credentials');

    for (const [key, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
      headers.set(key, value);
    }

    if (!contentType.includes('text/html')) {
      headers.set('Content-Security-Policy', CSP_NON_HTML);
      return new Response(originResp.body, {
        status: originResp.status,
        statusText: originResp.statusText,
        headers,
      });
    }

    // HTML：擷取 Astro 每頁 CSP meta → 升級為標頭並移除 meta（改以單一標頭 CSP 為準）。
    let html = await originResp.text();
    const match = html.match(META_CSP_RE);

    if (match) {
      const cspBody = match[1].trim().replace(/;\s*$/, '');
      html = html.replace(match[0], '');
      headers.set('Content-Security-Policy', `${cspBody}; ${CSP_HEADER_ONLY}`);
    } else {
      // 找不到 Astro meta（例如尚未部署新 build 的過渡期 HTML）：不可套用 default-src 'self'，
      // 否則會擋掉無雜湊的內聯 script。只給 frame-ancestors 以保留 clickjacking 防護。
      headers.set('Content-Security-Policy', "frame-ancestors 'none'");
    }

    headers.delete('Content-Length');
    headers.delete('Content-Encoding');

    return new Response(html, {
      status: originResp.status,
      statusText: originResp.statusText,
      headers,
    });
  },
};
