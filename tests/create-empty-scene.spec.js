// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://galaxy.signage.me/signstudio';
const USERNAME = 'shpw01';
const PASSWORD = '123123';
const SCENE_NAME = `empty scene ${Date.now() % 10000}`;

test('create a new empty scene', async ({ page }) => {
  page.setDefaultTimeout(30000);

  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole('textbox', { name: 'user name or email' }).fill(USERNAME);
  await page.getByRole('textbox', { name: 'password' }).fill(PASSWORD);
  await page.getByRole('textbox', { name: 'password' }).press('Enter');
  await page.waitForURL('**/home', { timeout: 15000 });

  // Switch to advanced mode — retry until trigger shows "advanced mode"
  for (let attempt = 1; attempt <= 3; attempt++) {
    const currentMode = await page.locator('.mat-mdc-select-trigger').first().textContent();
    if (/advanced/i.test(currentMode ?? '')) break;

    await page.evaluate(() => {
      document.querySelector('.mat-mdc-select-trigger')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(1500);
    await page.waitForSelector('mat-option', { timeout: 5000 });
    const pos = await page.evaluate(() => {
      const opt = [...document.querySelectorAll('mat-option')]
        .find(o => /advanced/i.test(o.textContent ?? ''));
      if (!opt) return null;
      const r = opt.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    });
    if (pos) await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(2000);
  }

  // Verify advanced mode is active (5s grace period)
  await expect(page.locator('.mat-mdc-select-trigger').first()).toContainText(/advanced mode/i, { timeout: 5000 });

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
