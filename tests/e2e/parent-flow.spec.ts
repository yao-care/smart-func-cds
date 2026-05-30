import { test, expect } from '@playwright/test';

/**
 * E2E parent flow happy path. Covers the spec-promised journey:
 *   home → child profile → questionnaire → all questions → summary.
 *
 * Scope: validates the integration of layout + AssessmentShell + IndexedDB
 * + Svelte 5 runes state across two module transitions. Subsequent modules
 * (game / voice / video / drawing) need browser hardware APIs (mic, camera,
 * canvas pointer events with timing) and are covered by unit tests at the
 * engine layer instead.
 *
 * Uses the 2-6m age group (4 questions) so the per-answer 520ms feedback
 * delay × N fits comfortably in the default 30s test budget.
 */

test.describe('Parent assessment flow', () => {
  test.beforeEach(async ({ context }) => {
    // Isolate IndexedDB / localStorage across tests via fresh browser context
    // (Playwright defaults to fresh context per test in this config).
    await context.clearCookies();
  });

  test('home page renders with the assessment shell', async ({ page }) => {
    await page.goto('/assess/');
    await expect(page).toHaveTitle(/成人功能健康評估/);
    // Step indicator with 7 steps is the canonical sign the shell loaded
    await expect(page.getByRole('heading', { name: '受測者基本資料' })).toBeVisible({ timeout: 10000 });
  });

  test('child profile form → submit → questionnaire appears', async ({ page }) => {
    await page.goto('/assess/');

    // Wait for the form to hydrate (client:load island)
    await expect(page.getByRole('heading', { name: '兒童基本資料' })).toBeVisible({ timeout: 10000 });

    // Fill the birth date — 4 months ago so the age maps to 2-6m
    const birth = new Date();
    birth.setMonth(birth.getMonth() - 4);
    const yyyy = birth.getFullYear();
    const mm = String(birth.getMonth() + 1).padStart(2, '0');
    const dd = String(birth.getDate()).padStart(2, '0');
    await page.getByLabel(/出生日期/).fill(`${yyyy}-${mm}-${dd}`);

    // Pick sex — 男
    // Default gender state is 'male' — no interaction needed.

    // Submit
    await page.getByRole('button', { name: '開始評估' }).click();

    // Land on questionnaire step — domain badge + a question text appear
    // (waiting up to 5s for hydration + nav)
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 5000 });
  });

  test('can answer all questions and reach the questionnaire summary', async ({ page }) => {
    test.setTimeout(60_000); // allow for 520ms × ~4 feedback delays + waits

    await page.goto('/assess/');
    await expect(page.getByRole('heading', { name: '兒童基本資料' })).toBeVisible({ timeout: 10000 });

    // Fill profile (4-month-old → 2-6m age group, 4 questions)
    const birth = new Date();
    birth.setMonth(birth.getMonth() - 4);
    const dateStr = birth.toISOString().slice(0, 10);
    await page.getByLabel(/出生日期/).fill(dateStr);
    // Default gender state is 'male' — no interaction needed.
    await page.getByRole('button', { name: '開始評估' }).click();

    // We're now on the questionnaire step. Click the first option of each
    // question until the summary screen appears.
    for (let i = 0; i < 20; i++) {
      // Summary screen is the terminal state
      const summary = page.getByText('問卷完成！');
      if (await summary.isVisible().catch(() => false)) break;

      // Click the first .option-btn that's currently visible
      const firstOption = page.locator('.option-btn').first();
      await firstOption.click();

      // Wait for the 520ms feedback animation + state advance
      await page.waitForTimeout(700);
    }

    // Summary phase reached
    await expect(page.getByText('問卷完成！')).toBeVisible({ timeout: 5000 });

    // Each domain row should show score / max ratio
    await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible();
  });

  test('landing page links through to the assessment', async ({ page }) => {
    await page.goto('/');
    // 落地頁不應直接顯示評估表單
    await expect(page.getByRole('heading', { name: '兒童基本資料' })).toHaveCount(0);
    // 點主 CTA 進入評估
    await page.getByRole('link', { name: '開始評估' }).first().click();
    await expect(page).toHaveURL(/\/assess/);
    await expect(page.getByRole('heading', { name: '兒童基本資料' })).toBeVisible({ timeout: 10000 });
  });
});
