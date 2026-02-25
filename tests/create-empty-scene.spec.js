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
  await page.locator('mat-dialog-container button', { hasText: /create scene/i }).click({ force: true });

  // Verify scene editor opened: toolbox is visible and scene name appears in top bar
  await expect(page.getByText('toolbox')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(SCENE_NAME).first()).toBeVisible({ timeout: 10000 });
});
