# Smart Func — 安全標頭前置代理 Worker（未啟用／保留為未來選項）

> **狀態（2026-06-10）：未部署。** 決策為「接受 GitHub Pages 標頭層限制」。
> 原因：`yao.care` 目前不在任何可用的 Cloudflare 帳號（登入帳號 0 zone），無 zone 可綁 route；
> 站台直連 GitHub Pages。本目錄保留為**未來若採方案 A（把 yao.care 搬上 Cloudflare）的現成實作**。
> 已關閉的發現（依賴、SAST、CSP 內容層）見 repo 根 `SECURITY-HEADERS.md`。
>
> 啟用前提：先把 `yao.care` 整個網域搬上 Cloudflare（改 nameserver、完整搬 DNS/MX 記錄）。

把 `smart-func-cds.yao.care` proxy 過 Cloudflare，由邊緣 Worker 注入 GitHub Pages 無法設定的
安全回應標頭，並把 Astro 建置期產生的每頁 CSP（含 script/style 雜湊）升級為真正的
`Content-Security-Policy` 標頭。對應資安掃描報告（20260610-044816-04b8）的 Web 層 High/Low 發現。

## 為什麼需要這層

站台是 Astro SSG，部署於 **GitHub Pages**，而 GitHub Pages **不允許自訂任何回應標頭**。
ZAP 回報的 clickjacking、CORS 寬鬆、缺 CSP/XCTO/COOP/Permissions-Policy 全是標頭層問題，
唯一的修法是在站台前面加一層可改標頭的代理（Cloudflare）。

## 注入的標頭

| 標頭 | 值 | 對應發現 |
|---|---|---|
| `Content-Security-Policy` | Astro 每頁雜湊 + `frame-ancestors 'none'` + `style-src-attr 'unsafe-inline'` | CSP unsafe-inline/wildcard/缺指令、clickjacking |
| `X-Frame-Options` | `DENY` | clickjacking |
| `X-Content-Type-Options` | `nosniff` | 缺 XCTO |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | 缺 COOP |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 強化 |
| `Permissions-Policy` | 僅放行 `microphone/fullscreen/autoplay=(self)` | 缺 Permissions-Policy |
| `Access-Control-Allow-Origin` | （移除 GitHub 的 `*`） | CORS 寬鬆 |

CSP 重點：`script-src` = 雜湊 + `'self'` + `'wasm-unsafe-eval'`（ONNX），`style-src` = 雜湊 + `'self'`，
兩者皆**無 `unsafe-inline`**；`connect-src 'self' https: blob:` 保留 SMART-on-FHIR/GCM 動態收案 base。
COEP 故意不設，避免打掛 YouTube 教學影片（僅 ZAP LOW）。

## 本機驗證（不需 Cloudflare）

```bash
pnpm build
node infra/security-headers-worker/local-verify.mjs   # http://localhost:8788
```

`local-verify.mjs` 複刻 Worker 標頭邏輯 serve `dist/`，可用瀏覽器 DevTools 觀察 console 是否有
CSP 違規。已驗證：script 水合正常、動態 `style=""` 屬性經 `style-src-attr` 放行生效。

## 生產部署（⚠️ 對外、影響線上醫療 CDSS，請逐步確認）

1. **DNS**：在 Cloudflare 的 `yao.care` zone，把 `smart-func-cds` 記錄設為 **Proxied（橘雲）**，
   指向 GitHub Pages（`185.199.108.153`、`.109`、`.110`、`.111`，或 CNAME 至 `<org>.github.io`）。
   GitHub Pages「Enforce HTTPS」維持開啟；Cloudflare SSL/TLS 模式用 **Full**。
2. **部署 Worker**：
   ```bash
   cd infra/security-headers-worker
   npx wrangler deploy
   ```
3. **綁路由**：取消 `wrangler.jsonc` 中 `routes` 的註解後重新 `npx wrangler deploy`，
   讓 Worker 接管 `smart-func-cds.yao.care/*`。
4. **驗證**：
   ```bash
   curl -sI https://smart-func-cds.yao.care/ | grep -iE 'content-security|x-frame|cross-origin|permissions|x-content'
   ```
   並實測 /assess /result 流程、YouTube 教學影片、收案上傳（GCM）皆正常。
5. **回滾**：DNS 記錄改回 DNS-only（灰雲）或移除 `routes` 重新部署即可立即恢復直連 GitHub Pages。

## 注意

- 站台每次改版（新增/變更內聯 script 或 style）後，Astro 會重算雜湊；Worker 從各頁 meta 動態
  讀取，**無需手動同步雜湊**。
- Worker 對 HTML 會 buffer 後重寫（移除 meta CSP）；頁面體積小，效能影響可忽略。
