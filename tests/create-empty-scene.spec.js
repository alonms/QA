// @ts-check
import { test, expect } from '@playwright/test';
import { loginAndSetup } from './helpers/login.mjs';

const SCENE_NAME = `empty scene ${Date.now() % 10000}`;

test('create a new empty scene', async ({ page }) => {
  await loginAndSetup(page);

  // Go to scenes
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('span')]
      .find(e => e.textContent?.trim().toLowerCase() === 'scenes');
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForURL('**/editor/list', { timeout: 15000 });

  // Click "+ create scene"
  await page.locator('button', { hasText: /create scene/i }).click({ force: true });
  await page.waitForSelector('text=new empty scene', { timeout: 5000 });

  // Select "new empty scene" (exact match to avoid matching scenes named "new empty scene test")
  await page.getByText('new empty scene', { exact: true }).click({ force: true });
  await page.waitForSelector('mat-dialog-container input', { timeout: 5000 });

  // Enter scene name
  const nameInput = page.locator('mat-dialog-container input').first();
  await nameInput.click({ force: true, clickCount: 3 });
  await page.keyboard.press('Control+a');
  await page.keyboard.type(SCENE_NAME);

  // Confirm
  await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container');
    if (!dialog) return;
    for (const btn of dialog.querySelectorAll('button')) {
      if (/create scene/i.test(btn.textContent ?? '')) { btn.click(); return; }
    }
  });

  await page.waitForTimeout(5000);

  // If still on list, double-click the scene to open it
  if (page.url().includes('editor/list')) {
    await page.evaluate((name) => {
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length === 0 && el.textContent?.trim() === name) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) {
            el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            return;
          }
        }
      }
    }, SCENE_NAME);
    await page.waitForTimeout(5000);
  }

  await page.waitForURL('**/editor/**', { timeout: 15000 });

  // Verify scene name appears in top bar
  await expect(page.getByText(SCENE_NAME).first()).toBeVisible({ timeout: 10000 });
});
