// @ts-check
import { test, expect } from '@playwright/test';
import { loginAndSetup } from './helpers/login.mjs';

const SCENE_NAME = `clock scene ${Date.now() % 10000}`;

// ── configurable clock properties ────────────────────────────
const CLOCK_WIDTH  = 300;
const CLOCK_HEIGHT = 200;
const CLOCK_MASK   = 'DD MMMM YYYY';
const FONT_SIZE    = 32;
const FONT_NAME    = 'Calibri';
const FONT_COLOR   = '#ffff00';
// ──────────────────────────────────────────────────────────────

/**
 * Finds the numeric field by its label text, clicks its "edit" button,
 * then fills the spinbutton that appears.
 */
async function setNumericField(page, fieldText, value) {
  await page.evaluate((text) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === text) {
        let node = el.parentElement;
        for (let i = 0; i < 5; i++) {
          const btn = node?.querySelector('button');
          if (btn) { btn.click(); return; }
          node = node?.parentElement ?? null;
        }
      }
    }
  }, fieldText);
  await page.waitForTimeout(200);
  const spins = page.getByRole('spinbutton');
  const count = await spins.count();
  const spin  = spins.nth(count - 1);
  await spin.fill(String(value));
  await spin.press('Enter');
  await page.waitForTimeout(200);
}

test('add clock to scene and configure properties', async ({ page }) => {
  await loginAndSetup(page);

  // ─── Go to scenes ────────────────────────────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('span')]
      .find(e => e.textContent?.trim().toLowerCase() === 'scenes');
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForURL('**/editor/list', { timeout: 15000 });

  // ─── Create a fresh empty scene ──────────────────────────────
  await page.locator('button', { hasText: /create scene/i }).click({ force: true });
  await page.waitForSelector('text=new empty scene', { timeout: 5000 });
  await page.getByText('new empty scene', { exact: true }).click({ force: true });
  await page.waitForSelector('mat-dialog-container input', { timeout: 5000 });

  const nameInput = page.locator('mat-dialog-container input').first();
  await nameInput.click({ force: true, clickCount: 3 });
  await page.keyboard.press('Control+a');
  await page.keyboard.type(SCENE_NAME);
  await page.locator('mat-dialog-container button', { hasText: /create scene/i })
    .click({ force: true });

  await expect(page.getByText('toolbox')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2000);

  // ─── Drag Clock component from toolbox onto the canvas ───────
  const dragSrc = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Clock') {
        const r = el.getBoundingClientRect();
        if (r.x < 700 && r.y > 100 && r.width > 10 && r.height > 10) {
          const drag = el.closest('[draggable="true"]') || el.parentElement;
          const dr   = (drag ?? el).getBoundingClientRect();
          if (dr.x < 700)
            return { x: Math.round(dr.x + dr.width / 2), y: Math.round(dr.y + dr.height / 2) };
        }
      }
    }
    return null;
  });
  if (!dragSrc) throw new Error('Clock component not found in toolbox');

  const dropTgt = await page.evaluate(() => {
    for (const sel of ['app-screen', '.player-canvas', '[class*="viewport"]', '[class*="scene-main"]']) {
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 400)
          return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
    }
    return { x: Math.round(window.innerWidth * 0.55), y: Math.round(window.innerHeight * 0.48) };
  });

  // Slow drag so Angular CDK drag-drop picks it up
  await page.mouse.move(dragSrc.x, dragSrc.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  const STEPS = 25;
  for (let i = 1; i <= STEPS; i++) {
    await page.mouse.move(
      Math.round(dragSrc.x + (dropTgt.x - dragSrc.x) * i / STEPS),
      Math.round(dragSrc.y + (dropTgt.y - dragSrc.y) * i / STEPS),
    );
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(1500);

  // Click the dropped component to select it
  await page.mouse.click(dropTgt.x, dropTgt.y);
  await page.waitForTimeout(500);

  await expect(page.getByRole('button', { name: 'layout' })).toBeVisible({ timeout: 5000 });

  // ─── Layout: set width and height ────────────────────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);

  await setNumericField(page, 'width',  CLOCK_WIDTH);
  await setNumericField(page, 'height', CLOCK_HEIGHT);

  // ─── Clock tab: type, mask, and font properties ──────────────
  await page.getByRole('button', { name: 'Clock' }).click();
  await page.waitForTimeout(300);

  // Set type to "date"
  await page.getByRole('combobox', { name: 'type' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: 'date', exact: true }).click();
  await page.waitForTimeout(300);

  // Set type to "custom"
  await page.getByRole('combobox', { name: 'type' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: 'custom' }).click();
  await page.waitForTimeout(300);

  // Set mask
  await page.getByRole('textbox', { name: 'mask' }).fill(CLOCK_MASK);
  await page.waitForTimeout(300);

  // Font size
  await page.locator('app-font-selector')
    .getByRole('button').filter({ hasText: 'edit' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('spinbutton').first().fill(String(FONT_SIZE));
  await page.getByRole('spinbutton').first().press('Enter');
  await page.waitForTimeout(200);

  // Font color — click hex textbox to expand colour picker, then fill
  await page.locator('app-font-selector').getByRole('textbox').first().click();
  await page.waitForTimeout(300);
  const hexInput = page.locator('app-font-selector').getByRole('textbox').nth(1);
  await hexInput.fill(FONT_COLOR);
  await hexInput.press('Enter');
  await page.waitForTimeout(500);

  // Font name — click via evaluate to bypass color-picker overlay
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('app-font-selector button')];
    const btn = btns.find(b => /^font$/.test(b.textContent?.trim() ?? ''));
    btn?.click();
  });
  await page.getByRole('dialog').waitFor({ timeout: 5000 });
  const filterInput = page.getByRole('textbox', { name: 'filter list...' });
  await filterInput.clear();
  await filterInput.pressSequentially(FONT_NAME, { delay: 50 });
  await page.waitForTimeout(2000);
  await page.evaluate((fontName) => {
    const cells = [...document.querySelectorAll('[role="cell"]')];
    const cell = cells.find(c => c.textContent?.trim() === fontName);
    cell?.click();
  }, FONT_NAME);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'select font' }).click();
  await page.waitForTimeout(500);

  // ─── Drag second Clock component to a different part of the scene ──
  // Click an empty area first to deselect the current component
  await page.mouse.click(dropTgt.x - 300, dropTgt.y - 200);
  await page.waitForTimeout(500);

  const dragSrc2 = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Clock') {
        const r = el.getBoundingClientRect();
        if (r.x < 700 && r.y > 100 && r.width > 10 && r.height > 10) {
          const drag = el.closest('[draggable="true"]') || el.parentElement;
          const dr   = (drag ?? el).getBoundingClientRect();
          if (dr.x < 700)
            return { x: Math.round(dr.x + dr.width / 2), y: Math.round(dr.y + dr.height / 2) };
        }
      }
    }
    return null;
  });
  if (!dragSrc2) throw new Error('Clock component not found in toolbox (2nd drag)');

  // Drop target offset to upper-right quadrant so it doesn't overlap the first clock
  const dropTgt2 = await page.evaluate(() => {
    for (const sel of ['app-screen', '.player-canvas', '[class*="viewport"]', '[class*="scene-main"]']) {
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 400)
          return { x: Math.round(r.x + r.width * 0.7), y: Math.round(r.y + r.height * 0.3) };
      }
    }
    return { x: Math.round(window.innerWidth * 0.7), y: Math.round(window.innerHeight * 0.35) };
  });

  await page.mouse.move(dragSrc2.x, dragSrc2.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  const STEPS2 = 25;
  for (let i = 1; i <= STEPS2; i++) {
    await page.mouse.move(
      Math.round(dragSrc2.x + (dropTgt2.x - dragSrc2.x) * i / STEPS2),
      Math.round(dragSrc2.y + (dropTgt2.y - dragSrc2.y) * i / STEPS2),
    );
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(1500);

  // Click the second dropped component to select it
  await page.mouse.click(dropTgt2.x, dropTgt2.y);
  await page.waitForTimeout(500);

  await expect(page.getByRole('button', { name: 'layout' })).toBeVisible({ timeout: 5000 });

  // ─── Layout: set width and height (2nd clock) ─────────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);

  await setNumericField(page, 'width',  CLOCK_WIDTH);
  await setNumericField(page, 'height', CLOCK_HEIGHT);

  // ─── Clock tab: set type to date_time + font properties ───────
  await page.getByRole('button', { name: 'Clock' }).click();
  await page.waitForTimeout(300);

  // Set type to "date_time"
  await page.getByRole('combobox', { name: 'type' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: 'date_time' }).click();
  await page.waitForTimeout(300);

  // Font size
  await page.locator('app-font-selector')
    .getByRole('button').filter({ hasText: 'edit' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('spinbutton').first().fill(String(FONT_SIZE));
  await page.getByRole('spinbutton').first().press('Enter');
  await page.waitForTimeout(200);

  // Font color
  await page.locator('app-font-selector').getByRole('textbox').first().click();
  await page.waitForTimeout(300);
  const hexInput2 = page.locator('app-font-selector').getByRole('textbox').nth(1);
  await hexInput2.fill(FONT_COLOR);
  await hexInput2.press('Enter');
  await page.waitForTimeout(500);

  // Font name — click via evaluate to bypass color-picker overlay
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('app-font-selector button')];
    const btn = btns.find(b => /^font$/.test(b.textContent?.trim() ?? ''));
    btn?.click();
  });
  await page.getByRole('dialog').waitFor({ timeout: 5000 });
  const filterInput2 = page.getByRole('textbox', { name: 'filter list...' });
  await filterInput2.clear();
  await filterInput2.pressSequentially(FONT_NAME, { delay: 50 });
  await page.waitForTimeout(2000);
  await page.evaluate((fontName) => {
    const cells = [...document.querySelectorAll('[role="cell"]')];
    const cell = cells.find(c => c.textContent?.trim() === fontName);
    cell?.click();
  }, FONT_NAME);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'select font' }).click();
  await page.waitForTimeout(500);

  // ─── Save ─────────────────────────────────────────────────────
  await page.locator('.center-items > button:nth-child(3)').click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 5000 });
});
