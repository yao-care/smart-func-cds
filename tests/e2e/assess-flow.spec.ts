import { test, expect, type Page } from '@playwright/test';

/**
 * E2E 成人 IC 評估 happy path：
 *   home → 受測者基本資料 → 功能問卷 → 全部作答 → 查看評估結果。
 *
 * Scope: 驗證 layout + AssessmentShell + IndexedDB + Svelte 5 runes 跨步驟整合。
 * 客觀測驗（語音/動作）需瀏覽器硬體 API，改由 engine 層單元測試覆蓋。
 */

// ---- 自適應問卷輔助 ----

/** 症狀題 ID 集合（higher_is_worse；健康路徑選 score=0）*/
const SYMPTOM_Q_IDS = new Set([
  'vitality.fatigue.q1',
  'psychological.depression.q1',
  'psychological.depression.q2',
  'psychological.self_harm.q1',
  'psychological.anxiety.q1',
  'psychological.anxiety.q2',
]);

/**
 * 進入 /assess/ 並填妥基本資料，停在問卷第一題。
 * 呼叫者可接著對 page 操作問卷。
 * 等待 [data-question-id] 出現（Svelte 5 hydration 完成後才可見）。
 */
async function goToQuestionnaire(page: Page): Promise<void> {
  await page.goto('/assess/');
  await expect(page.getByRole('heading', { name: '受測者基本資料' })).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/姓名/).fill('測試受測者');
  await page.getByLabel(/出生日期/).fill('1980-06-15');
  await page.getByRole('button', { name: '開始評估' }).click();
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 8_000 });
  // 等待 data-question-id 出現（QuestionnaireModule hydration 完成的信號）
  await expect(page.locator('[data-question-id]')).toBeVisible({ timeout: 15_000 });
}

/**
 * 讀取 data-question-id（位於 .domain-badge[data-question-id]），
 * 依 symptom/capacity 點對應分數選項，等待 isSaving 結束（≈400 ms）。
 * @param scoreOverride 若提供，強制點該 data-score 的選項（用於刻意篩陽情境）。
 */
async function answerCurrentQuestion(page: Page, scoreOverride?: number): Promise<string> {
  const badge = page.locator('[data-question-id]');
  await expect(badge).toBeVisible({ timeout: 5_000 });
  const qid = await badge.getAttribute('data-question-id');
  if (!qid) throw new Error('data-question-id not found');

  let targetScore: number;
  if (scoreOverride !== undefined) {
    targetScore = scoreOverride;
  } else if (SYMPTOM_Q_IDS.has(qid)) {
    targetScore = 0;
  } else {
    // capacity 題：找最高 data-score
    const allScores = await page.locator('.option-btn').evaluateAll(
      els => els.map(el => Number(el.getAttribute('data-score')))
    );
    targetScore = Math.max(...allScores);
  }

  await page.locator(`.option-btn[data-score="${targetScore}"]`).click();
  // handleAnswer 有 320ms setTimeout；等待按鈕重新 enabled（isSaving=false）
  await page.locator('.option-btn').first().waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {
    // 若最後一題答完，option-btn 消失（進摘要），catch 掉即可
  });
  return qid;
}

// ----------------------------------------------------------------

test.describe('成人 IC 評估流程', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('進入評估顯示受測者基本資料表單', async ({ page }) => {
    await page.goto('/assess/');
    await expect(page).toHaveTitle(/Smart Func/);
    await expect(page.getByRole('heading', { name: '受測者基本資料' })).toBeVisible({ timeout: 10000 });
  });

  test('填基本資料 → 送出 → 進入功能問卷', async ({ page }) => {
    await page.goto('/assess/');
    await expect(page.getByRole('heading', { name: '受測者基本資料' })).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/姓名/).fill('測試受測者');
    await page.getByLabel(/出生日期/).fill('1980-06-15');

    await page.getByRole('button', { name: '開始評估' }).click();

    // 問卷步驟：進度條 + 選項按鈕出現
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 });
  });

  test('可答完所有題目並抵達評估結果', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/assess/');
    await expect(page.getByRole('heading', { name: '受測者基本資料' })).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/姓名/).fill('測試受測者');
    await page.getByLabel(/出生日期/).fill('1980-06-15');
    await page.getByRole('button', { name: '開始評估' }).click();

    // 逐題點選項，直到出現「查看評估結果」。
    // 認知自評螢檢點「最佳」選項以維持 cognition=high，避免進入計時的客觀測驗 phase
    // （客觀測驗的進入/施測由 component 單元測試覆蓋，不在此 e2e 重跑計時測驗）。
    const seeResult = page.getByRole('button', { name: '查看評估結果' });
    const opts = page.locator('.option-btn');
    for (let i = 0; i < 60; i++) {
      if (await seeResult.isVisible().catch(() => false)) break;
      if (await opts.first().isVisible().catch(() => false)) {
        const qid = await page.locator('[data-testid="current-question-id"]')
          .getAttribute('data-question-id').catch(() => null);
        if (qid === 'cognition.cognitive_self_report.q1') {
          await opts.last().click();
        } else {
          await opts.first().click();
        }
        await page.waitForTimeout(120);
      } else {
        await page.waitForTimeout(120);
      }
    }

    await expect(seeResult).toBeVisible({ timeout: 5000 });
    await seeResult.click();

    // 結果頁：分流卡 + 收案點選單
    await expect(page.locator('.triage-card')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('上傳評估結果至收案點')).toBeVisible();
  });

  test('落地頁不直接顯示評估表單，CTA 進入評估', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '受測者基本資料' })).toHaveCount(0);
    await page.getByRole('link', { name: '開始評估' }).first().click();
    await expect(page).toHaveURL(/\/assess/);
    await expect(page.getByRole('heading', { name: '受測者基本資料' })).toBeVisible({ timeout: 10000 });
  });

  // ================================================================
  // 自適應問卷三情境
  // ================================================================

  test('健康路徑：恰好 12 題螢檢後出現摘要，無詳問、無危機', async ({ page }) => {
    test.setTimeout(90_000);

    await goToQuestionnaire(page);

    const progressLabel = page.locator('[data-testid="progress-label"]');
    const summary = page.getByRole('heading', { name: '問卷完成！' });
    const crisisRegion = page.locator('[role="region"][aria-label="危機求助資源"]');

    let answeredCount = 0;

    // 逐題作答，直到摘要出現（最多 15 題以防迴圈卡住）
    for (let i = 0; i < 15; i++) {
      if (await summary.isVisible({ timeout: 500 }).catch(() => false)) break;

      // 答題前確認 option-btn 可見
      await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5_000 });
      await answerCurrentQuestion(page);
      answeredCount++;

      // 每答完一題確認未出現危機資源
      const crisisVisible = await crisisRegion.isVisible({ timeout: 300 }).catch(() => false);
      expect(crisisVisible, `答第 ${answeredCount} 題後不應出現危機資源`).toBe(false);
    }

    // 摘要應已出現
    await expect(summary).toBeVisible({ timeout: 3_000 });

    // 恰好答 12 題
    expect(answeredCount, '健康路徑應恰好作答 12 題螢檢').toBe(12);

    // 確認 depression.q3（PHQ-8 detail）從未出現在頁面
    const depressionQ3 = page.locator('[data-question-id="psychological.depression.q3"]');
    await expect(depressionQ3).toHaveCount(0);
  });

  test('憂鬱篩陽：depression.q1 + q2 均選最高分 → 展開 PHQ-8（出現 q3）', async ({ page }) => {
    test.setTimeout(90_000);

    await goToQuestionnaire(page);

    const summary = page.getByRole('heading', { name: '問卷完成！' });

    // 逐題作答；遇到 depression.q1 / q2 強制選最高分（score=3）觸發篩陽
    for (let i = 0; i < 30; i++) {
      if (await summary.isVisible({ timeout: 500 }).catch(() => false)) break;

      const badge = page.locator('[data-question-id]');
      const visible = await badge.isVisible({ timeout: 3_000 }).catch(() => false);
      if (!visible) break;

      const qid = await badge.getAttribute('data-question-id');
      if (qid === 'psychological.depression.q1' || qid === 'psychological.depression.q2') {
        // 強制最高分 → 觸發 revealDetailWhen（sum >= 3）
        await answerCurrentQuestion(page, 3);
      } else {
        await answerCurrentQuestion(page);
      }

      // 篩陽後若 q3 已出現即可提早斷言並結束
      const q3badge = page.locator('[data-question-id="psychological.depression.q3"]');
      if (await q3badge.isVisible({ timeout: 300 }).catch(() => false)) {
        // PHQ-8 detail 已展開
        break;
      }
    }

    // 斷言：depression.q3 出現（PHQ-8 detail 已展開）
    await expect(
      page.locator('[data-question-id="psychological.depression.q3"]')
    ).toBeVisible({ timeout: 5_000 });

    // 也可驗證題幹文字（與 YAML 完全一致）
    await expect(
      page.getByText('過去 2 週，您入睡困難、睡不安穩，或睡得太多')
    ).toBeVisible({ timeout: 3_000 });
  });

  test('自我傷害意念：self_harm.q1 選非零 → 顯示危機求助資源與專線 1925', async ({ page }) => {
    test.setTimeout(90_000);

    await goToQuestionnaire(page);

    const crisisRegion = page.locator('[role="region"][aria-label="危機求助資源"]');

    // 逐題作答，遇到 self_harm.q1 強制選 score=1（非零）觸發危機資源
    for (let i = 0; i < 20; i++) {
      const badge = page.locator('[data-question-id]');
      const visible = await badge.isVisible({ timeout: 3_000 }).catch(() => false);
      if (!visible) break;

      const qid = await badge.getAttribute('data-question-id');
      if (qid === 'psychological.self_harm.q1') {
        await answerCurrentQuestion(page, 1);
        break; // 答完即停，立即驗證
      } else {
        await answerCurrentQuestion(page);
      }
    }

    // 斷言：危機資源 region 出現
    await expect(crisisRegion).toBeVisible({ timeout: 5_000 });

    // 斷言：安心專線 1925 可見
    await expect(page.locator('a[href="tel:1925"]')).toBeVisible({ timeout: 3_000 });

    // 也確認可見文字包含 1925
    await expect(page.getByText('1925')).toBeVisible({ timeout: 3_000 });
  });
});
