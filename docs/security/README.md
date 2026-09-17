# 資安治理文件（ISMS 記錄）

本目錄存放 smart-func-cds 的資訊安全管理（ISMS）程序與記錄。結構對齊
`smart-geri-cds` / `smart-pedi-cds` 的同名目錄——三個 CDS app 架構相同
（Astro SSG、零後端、GitHub Pages），資安前提與事件情境一致，文件格式刻意保持一致
以便一次覆核三個 repo。

> ⚠️ **標示「（待填）」的欄位尚未有真實記錄。** 演練、還原測試的日期與參與人員
> 必須由負責人於**實際執行後**填入。請勿以範本內容充當合規證據。
>
> 相對地，`dependency-risk-acceptance.md` 的內容是**已核實的實測結果**，
> 每筆都附可驗證的判定依據。

## 控制項對應

| ISO 27001 控制項 | 文件 | 狀態 |
|---|---|---|
| A.8.8 技術弱點管理 | [dependency-risk-acceptance.md](dependency-risk-acceptance.md) | ✅ 掃描 `20260714-231345-04b8` 已處置（High 21→0，commit `044bb7a`）；2026-09-17 複查發現 1 筆 critical（astro AVIF RCE），當日升級 Astro 7 修補，audit critical 歸零 |
| A.5.24 事件回應規劃與演練 | [incident-response-plan.md](incident-response-plan.md) | ⚠️ 程序已訂，**演練記錄待填** |
| A.5.26 事件回應聯絡窗口 | [incident-response-contacts.md](incident-response-contacts.md) | ⚠️ 角色信箱已定，**備援監看者待確認** |
| A.5.29 備份還原測試 | 見下方「本系統的備份標的」 | ⚠️ 零後端，無資料庫備份標的；原始碼／部署設定的還原測試**待執行** |

## 本系統的資安特性（撰寫程序時的前提）

- **零後端**：無應用伺服器、無自管資料庫。靜態檔部署於 GitHub Pages
  （自訂網域 `smart-func-cds.yao.care`，強制 HTTPS）。
- **資料落地點**：評估資料存於受測者瀏覽器的 IndexedDB；上傳的 FHIR 資料寫入
  **收案機構的伺服器**（醫院 FHIR 或 GCM 收案端），非本系統持有。上傳為選用。
- **本系統「需要備份／還原」的資產**：原始碼 Git repo、GitHub Pages 部署設定、
  網域 DNS 設定、CI/部署密鑰。**不是**傳統的伺服器資料庫備份。
- **主要事件情境**：供應鏈（npm 套件／GitHub Actions）污染、GitHub Pages 竄改或
  置換、網域或 DNS 劫持、密鑰外洩、影響臨床端瀏覽器的 XSS。
- **額外元件**：`infra/security-headers-worker`（安全標頭）與
  `SECURITY-HEADERS.md`；貢獻投稿走外部 worker（`PUBLIC_CONTRIBUTION_WORKER_URL`）。

## 維護方式

- **自動**：`.github/dependabot.yml` — github-actions 與 npm 定期檢查；
  major 升級不自動化，一律人工評估。
- **供應鏈規則**（見 CLAUDE.md）：`.github/workflows/` 的 `uses:` 一律釘 40 字元
  commit SHA ＋ `# vX.Y.Z` 註解，禁用可變 tag。
- **本檔與風險接受記錄於每次掃描後更新**：新增接受項、移除已修補項、
  覆核既有項的再評估條件。
