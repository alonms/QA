// @ts-check
import { test, expect } from '@playwright/test';
import { loginAndSetup } from './helpers/login.mjs';

test('import a weather scene template', async ({ page }) => {
  await loginAndSetup(page);

  // ─── Go to scenes ────────────────────────────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('span')]
      .find(e => e.textContent?.trim().toLowerCase() === 'scenes');
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForURL('**/editor/list', { timeout: 15000 });

  // ─── Create scene → import scene ─────────────────────────────
  await page.locator('button', { hasText: /create scene/i }).click({ force: true });
  await page.waitForSelector('text=import scene', { timeout: 5000 });
  await page.getByText('import scene', { exact: true }).click({ force: true });
  await page.waitForURL('**/editor/new', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // ─── Untick all categories ───────────────────────────────────
  await page.evaluate(() => {
    const checkboxes = [...document.querySelectorAll('mat-checkbox')];
    const allCat = checkboxes.find(cb => cb.textContent?.trim() === 'all categories');
    if (allCat) {
      const input = allCat.querySelector('input');
      if (input?.checked) {
        allCat.querySelector('label')?.click();
      }
    }
  });
  await page.waitForTimeout(1000);

  // ─── Enable only Weather category ────────────────────────────
  await page.evaluate(() => {
    const checkboxes = [...document.querySelectorAll('mat-checkbox')];
    const weather = checkboxes.find(cb => cb.textContent?.trim() === 'Weather');
    if (weather) {
      weather.scrollIntoView({ block: 'center' });
      weather.querySelector('label')?.click();
    }
  });
  await page.waitForTimeout(2000);

  // Verify Weather category is showing templates
  await expect(page.getByText('Weather (', { exact: false })).toBeVisible({ timeout: 5000 });

  // ─── Click the download button on the first weather template ──
  await page.evaluate(() => {
    const wrappers = [...document.querySelectorAll('.template-wrapper')];
    for (const wrapper of wrappers) {
      const overlay = wrapper.querySelector('.overlay');
      const downloadBtn = overlay?.querySelector('a');
      if (downloadBtn) {
        downloadBtn.click();
        return;
      }
    }
  });
  await page.waitForTimeout(2000);

  // ─── Click import in the preview dialog ──────────────────────
  const importBtn = page.getByRole('button', { name: /import/i });
  await expect(importBtn).toBeVisible({ timeout: 5000 });
  await importBtn.click();

  // ─── Wait for scene editor to load ───────────────────────────
  await expect(page.getByText('toolbox')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(2000);

  // ─── Save ─────────────────────────────────────────────────────
  await page.locator('.center-items > button:nth-child(3)').click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 5000 });
});
