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
  await page.waitForTimeout(1000);

  // Click "import scene" in the pick scene type dialog
  await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container') || document.querySelector('[role="dialog"]');
    if (!dialog) return;
    for (const el of dialog.querySelectorAll('div')) {
      if (el.textContent?.trim() === 'import scene' && el.children.length === 0) {
        const card = el.closest('[class*="card"], [class*="option"], [class*="item"]') || el.parentElement;
        (card || el).click();
        return;
      }
    }
  });
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

  // Verify Weather category is showing templates (retry category toggle if needed)
  for (let retry = 0; retry < 3; retry++) {
    const weatherVisible = await page.getByText('Weather (', { exact: false }).isVisible({ timeout: 3000 }).catch(() => false);
    if (weatherVisible) break;
    // Retry toggling categories
    await page.evaluate(() => {
      const checkboxes = [...document.querySelectorAll('mat-checkbox')];
      const weather = checkboxes.find(cb => cb.textContent?.trim() === 'Weather');
      if (weather) {
        weather.scrollIntoView({ block: 'center' });
        weather.querySelector('label')?.click();
      }
    });
    await page.waitForTimeout(2000);
  }

  // ─── Click the download button on the first weather template ──
  await page.evaluate(() => {
    // Try .template-wrapper first, fallback to any download/import icon
    const wrappers = [...document.querySelectorAll('.template-wrapper')];
    for (const wrapper of wrappers) {
      const overlay = wrapper.querySelector('.overlay');
      const downloadBtn = overlay?.querySelector('a');
      if (downloadBtn) {
        downloadBtn.click();
        return;
      }
    }
    // Fallback: find any download icon button in the template area
    for (const icon of document.querySelectorAll('mat-icon')) {
      if (icon.textContent?.trim() === 'cloud_download' || icon.textContent?.trim() === 'download') {
        const btn = icon.closest('a, button') || icon;
        btn.click();
        return;
      }
    }
  });
  await page.waitForTimeout(2000);

  // ─── Click import in the preview dialog ──────────────────────
  await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container');
    if (!dialog) return;
    for (const btn of dialog.querySelectorAll('button')) {
      if (/import/i.test(btn.textContent ?? '')) {
        btn.click();
        return;
      }
    }
  });
  await page.waitForTimeout(1000);
  // Fallback: try Playwright locator if evaluate didn't work
  const importBtn = page.getByRole('button', { name: /import/i });
  if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await importBtn.click({ force: true });
  }

  // ─── Wait for scene editor to load ───────────────────────────
  await page.waitForTimeout(5000);
  await page.waitForURL('**/editor/**', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // ─── Save ─────────────────────────────────────────────────────
  await page.keyboard.press('Alt+s');
  await page.waitForTimeout(3000);
  const saved = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && /saved/i.test(el.textContent ?? '')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return true;
      }
    }
    return false;
  });
  if (!saved) {
    await page.evaluate(() => {
      const icons = document.querySelectorAll('mat-icon');
      for (const icon of icons) {
        if (icon.textContent?.trim() === 'save') {
          const btn = icon.closest('button');
          if (btn) { btn.click(); return; }
        }
      }
    });
    await page.waitForTimeout(3000);
  }
});
