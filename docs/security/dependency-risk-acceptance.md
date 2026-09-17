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
上游新增了若干告警，其中 **1 筆 critical** 需要判定。

### 接受風險（暫不修補）

#### 1. astro 6.4.8 — Astro: Remote code execution through AVIF image optimization（Critical）

- **弱點**：透過 AVIF 影像最佳化路徑可達成遠端程式碼執行。
- **影響版本／修補版**：`<7.2.8` → `>=7.2.8`。**6.x 分支無修補版**，
  修補只存在於 Astro 7。
- **不適用理由（已核實）**：本專案**完全未使用 Astro 的影像最佳化**——
  `src/` 內無 `astro:assets` 匯入、無 `<Image>` / `<Picture>` 元件，
  `astro.config.mjs` 亦未設定 `image`。所有圖片為 `public/` 下的靜態檔，
  直接由 GitHub Pages 供應，不經最佳化管線。**觸發條件（AVIF 最佳化）
  在本專案不成立。**
  - 另：本站為 SSG，產物為靜態檔，執行期無 Node 伺服器可被觸及；
    即使觸發也僅限建置期（CI runner 與維運者本機），輸入為 repo 內自有檔案。
- **上游阻因**：修補需升級至 Astro 7（major）。跨 major 升級會牽動
  Content Layer、integrations 與既有產生檔管線，屬獨立工作，不宜夾在
  安全修補中倉促進行。
- **再評估條件**（任一成立即須立即處置）：
  1. 本專案開始使用 `astro:assets` / `<Image>` / `<Picture>`，或設定影像最佳化
     → **升級 Astro 7 必須先於該功能上線**。
  2. 出現針對建置期的實際利用手法，或 CI 開始處理外部來源的影像。
  3. Astro 7 升級評估完成（三個 CDS app 宜一併進行，版本相同）。
- **相同狀況的 repo**：`smart-geri-cds`、`smart-pedi-cds` 亦為 astro 6.4.8，
  同一判定成立；升級應三者同步評估。

#### 2. 其餘 high／moderate 告警

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
