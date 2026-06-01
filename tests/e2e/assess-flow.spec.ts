import { test, expect } from '@playwright/test';

/**
 * E2E 成人 IC 評估 happy path：
 *   home → 受測者基本資料 → 功能問卷 → 全部作答 → 查看評估結果。
 *
 * Scope: 驗證 layout + AssessmentShell + IndexedDB + Svelte 5 runes 跨步驟整合。
 * 客觀測驗（語音/動作）需瀏覽器硬體 API，改由 engine 層單元測試覆蓋。
 */

test.describe('成人 IC 評估流程', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('進入評估顯示受測者基本資料表單', async ({ page }) => {
    await page.goto('/assess/');
    await expect(page).toHaveTitle(/成人功能健康評估/);
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

    // 逐題點選項，直到出現「查看評估結果」
    const seeResult = page.getByRole('button', { name: '查看評估結果' });
    for (let i = 0; i < 60; i++) {
      if (await seeResult.isVisible().catch(() => false)) break;
      const opt = page.locator('.option-btn').first();
      if (await opt.isVisible().catch(() => false)) {
        await opt.click();
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
});
