# 資安掃描修補與標頭層風險接受紀錄

對應掃描報告 **20260610-044816-04b8**（Quality gate FAIL：critical 1、high 8）。
本文件記錄修補結果，以及標頭層發現的**風險接受決策**。

## 已修復並上線（main / GitHub Pages）

| 類別 | 處置 | 狀態 |
|---|---|---|
| 🔴 shell-quote 命令注入（CVE-2026-9277）| `pnpm.overrides` → 1.8.4 | ✅ |
| High devalue DoS | → 5.8.1 | ✅ |
| Medium svelte / postcss / protobufjs / ws | 升級（svelte 5.56.3 等）| ✅ |
| Medium uuid | **不修**：位於 `fhirclient→isomorphic-webcrypto→expo` 的 React Native 死分支，瀏覽器走原生 `crypto.subtle`，此碼永不執行；強升 11.x 會破 `xcode@3.0.1` | ✅ 評估後豁免 |
| High verify-seo 路徑穿越（SAST）| 誤報，`nosemgrep` + 說明（postbuild 守門、無外部輸入）| ✅ |
| High font-loader ReDoS（SAST）| 誤報，`nosemgrep` + 說明（`exportName` 編譯期字面值、`[^']+` 線性）| ✅ |
| High CSP unsafe-inline / wildcard / 缺指令 | Astro `security.csp` 每頁雜湊（`script-src`/`style-src` 無 unsafe-inline、無 wildcard，補 `default-src`/`object-src`/`base-uri` 等）+ `scripts/harden-csp.mjs` 注入 `style-src-attr` | ✅ CSP 內容層 |

CSP 內容層以 `<meta http-equiv>` 交付（GitHub Pages 唯一可行方式），已 Playwright 驗證
核心頁水合正常、動態 `style=""` 生效、零 CSP 違規。

## 風險接受：標頭層發現（2026-06-10）

下列發現屬 **HTTP 回應標頭層**，而站台部署於 **GitHub Pages（不允許自訂回應標頭）**，
且 `yao.care` 不在可用的 Cloudflare 帳號（無法以邊緣代理注入標頭）。經評估**接受風險**：

| 發現 | 現況 | 風險評估 |
|---|---|---|
| Clickjacking（`X-Frame-Options` / `frame-ancestors`）| 未設（標頭層才可生效，meta 的 `frame-ancestors` 被瀏覽器忽略）| 站台為純靜態、無伺服器端逐人資料；受測者資料全在 client 端 IndexedDB，不出現在 HTTP 回應。UI redressing 風險相對有限。 |
| CORS `Access-Control-Allow-Origin: *` | GitHub Pages 固定回傳、不可改 | 同上；回應不含逐人敏感資料，跨域讀取無可竊取的伺服器端機密。 |
| 缺 COOP / XCTO / Permissions-Policy（LOW）| 未設（標頭層）| 縱深防禦缺口，非直接可利用漏洞。 |

### 殘留風險的可選緩解（未實作，待決）
- **Clickjacking**：可在 `Base.astro` 加 JS framebusting（`if (top !== self) …`）作縱深防禦。
  不需任何 infra 變更（Astro 會自動把此 inline script 納入 CSP 雜湊），但**無法消除 ZAP 的標頭層告警**。

### 完全關閉標頭層發現的途徑（未採用）
- **方案 A**：把 `yao.care` 搬上 Cloudflare（改 nameserver）→ 啟用 `infra/security-headers-worker/`
  的現成 Worker 前置代理。GitHub Pages 與現有部署流程不變。
- **方案 B**：把本子網域 hosting 改到可設標頭的 host（Netlify / Vercel，CNAME 即可），
  以 `_headers` / `vercel.json` 設所有安全標頭、保留 Astro meta CSP。

採用任一方案時，`infra/security-headers-worker/` 內含可直接使用的 Worker 實作與本機驗證工具。
