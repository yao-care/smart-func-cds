# 相依弱點風險接受記錄（ISO 27001 A.8.8 技術弱點管理）

> 本檔記錄**經評估後決定暫不修補**的相依弱點，及其理由與再評估條件。
> 已修補者不列入此處，逕由 git log 與 Dependabot PR 佐證。
>
> ⚠️ 風險接受**不是**忽略：每筆均須有可驗證的不適用理由或上游阻因，
> 並訂定再評估時機。條件一旦改變即須重新處置。

## 掃描 `20260714-231345-04b8`（2026-07-14，commit `044bb7a`）

處置後結果：**High 21 → 0**，Quality Gate 由 FAIL 轉 PASS。

- SAST 17 High：GitHub Actions 全部 17 處 `uses:` 由可變 tag 釘至 40 字元
  commit SHA（annotated tag 已 deref 至 commit）。
- Trivy 4 High：astro 6.3.1→6.4.8（**不採報告建議的 6.4.6**——6.4.7 引入
  CVE-2026-59731 授權繞過迴歸，需 6.4.8）、vite 7.3.3→7.3.6（override）、
  ws 7.5.10→7.5.12（既有 override 範圍 `>=8.0.0 <8.20.1` 排除 7.x，另加條目）。

詳見 commit `044bb7a` 的完整訊息。

## 複查 2026-09-17（`pnpm audit`）

複查方式：`pnpm audit`（全量）與 `pnpm audit --prod`。距上次處置兩個月，
上游新增了若干告警，其中 **1 筆 critical** 已於同日升級修補（見下），其餘留待正式掃描判定。

### 已修補

#### astro 6.4.8 → 7.3.3 — Astro: Remote code execution through AVIF image optimization（Critical）

- **弱點**：透過 AVIF 影像最佳化路徑可達成遠端程式碼執行；影響 `<7.2.8`，
  **6.x 分支無修補版**，修補僅存在於 Astro 7。
- **處置**：2026-09-17 升級 `astro@^7.3.3` + `@astrojs/svelte@^9.0.1`
  （後者 peer 要求 astro ^7）＋ sitemap／rss 同步升版。
  升級後 `pnpm audit` 的 **critical 歸零**。
- **補充**：本專案原本就未使用 Astro 影像最佳化（無 `astro:assets` 匯入、
  無 `<Image>`／`<Picture>`、`astro.config.mjs` 未設 `image`），故此弱點的
  觸發條件先前即不成立；升級是為了根治而非緊急遏制。
- **驗證**：`pnpm check` 0 error、399 測試全綠、`pnpm build` 完成且 SEO 守門通過。
- **連帶**：`smart-geri-cds`、`smart-pedi-cds` 同步升級（三者版本一致）。
  geri 原本因 astro 6 綁定而接受的 esbuild 0.27.7 風險亦隨之消解。

### 接受風險（暫不修補）

#### 其餘 high／moderate 告警

`pnpm audit` 的計數同時涵蓋 devDependencies 與間接相依的多條路徑，數字會遠大於
實際暴露面（多為 DoS 類、僅在建置期或開發伺服器成立）。本次未逐筆接受，
處置方式為：交由 Dependabot 的定期 PR 收斂，並於下次正式掃描
（Trivy／SAST）時以掃描報告為準重新判定。

> 注意：`pnpm audit` **不是**正式掃描報告的替代品。此節僅為兩次正式掃描之間的
> 例行複查記錄。

## 維護方式

- **自動**：`.github/dependabot.yml` 定期檢查；安全性更新優先合併；
  major 升級排除自動化，一律人工評估。
- **人工**：每季相依複查；本檔於每次掃描後更新。
