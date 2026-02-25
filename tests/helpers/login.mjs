// @ts-check
import { expect } from '@playwright/test';

const BASE_URL  = 'https://galaxy.signage.me/signstudio';
const USERNAME  = 'shpw01';
const PASSWORD  = '123123';

/**
 * Logs in and switches to advanced mode.
 * Call at the start of every test.
 */
export async function loginAndSetup(page, { username = USERNAME, password = PASSWORD } = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.setDefaultTimeout(30000);

  // ─── Login ───────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole('textbox', { name: 'user name or email' }).fill(username);
  await page.getByRole('textbox', { name: 'password' }).fill(password);
  await page.getByRole('textbox', { name: 'password' }).press('Enter');
  await page.waitForURL('**/home', { timeout: 15000 });

  // ─── Switch to advanced mode ──────────────────────────────────
  for (let attempt = 1; attempt <= 3; attempt++) {
    const mode = await page.locator('.mat-mdc-select-trigger').first().textContent();
    if (/advanced/i.test(mode ?? '')) break;
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
  await expect(page.locator('.mat-mdc-select-trigger').first())
    .toContainText(/advanced mode/i, { timeout: 5000 });
}
