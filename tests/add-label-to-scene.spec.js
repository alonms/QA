// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://galaxy.signage.me/signstudio';
const USERNAME  = 'shpw01';
const PASSWORD  = '123123';
const SCENE_NAME = `label scene ${Date.now() % 10000}`;

// ── configurable label properties ─────────────────────────────
const LABEL_TEXT   = 'welcome to my test text!';
const LABEL_WIDTH  = 300;
const LABEL_HEIGHT = 200;
const FONT_SIZE    = 36;
const FONT_NAME    = 'Boogaloo';
const FONT_COLOR   = '#ff0000';
// ──────────────────────────────────────────────────────────────

/**
 * Finds the numeric field by its label text, clicks its "edit" button,
 * then fills the spinbutton that appears.
 * Uses the *last* open spinbutton so multiple fields can be edited in sequence
 * even if earlier spinbuttons remain open.
 */
async function setNumericField(page, fieldText, value) {
  await page.evaluate((text) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === text) {
        // Walk up until we find a container that holds an edit button
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
  const spin  = spins.nth(count - 1); // always target the most-recently opened spinbutton
  await spin.fill(String(value));
  await spin.press('Enter');
  await page.waitForTimeout(200);
}

test('add label to scene and change properties', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.setDefaultTimeout(30000);

  // ─── Login ───────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole('textbox', { name: 'user name or email' }).fill(USERNAME);
  await page.getByRole('textbox', { name: 'password' }).fill(PASSWORD);
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
  await page.waitForTimeout(2000); // let editor fully initialise

  // ─── Drag Label component from toolbox onto the canvas ───────
  // Find the "Label" chip in the toolbox (left ~500 px of screen)
  const dragSrc = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Label') {
        const r = el.getBoundingClientRect();
        if (r.x < 500 && r.y > 100 && r.width > 10 && r.height > 10) {
          const drag = el.closest('[draggable="true"]') || el.parentElement;
          const dr   = (drag ?? el).getBoundingClientRect();
          if (dr.x < 500)
            return { x: Math.round(dr.x + dr.width / 2), y: Math.round(dr.y + dr.height / 2) };
        }
      }
    }
    return null;
  });
  if (!dragSrc) throw new Error('Label component not found in toolbox');

  // Find the canvas drop target (centre of the editing area)
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

  // Slow drag so the Angular CDK drag-drop picks it up
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

  // Properties panel must show "layout" tab (confirms a component is selected)
  await expect(page.getByRole('button', { name: 'layout' })).toBeVisible({ timeout: 5000 });

  // ─── Layout: set width and height ────────────────────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);

  await setNumericField(page, 'width',  LABEL_WIDTH);
  await setNumericField(page, 'height', LABEL_HEIGHT);

  // ─── Label tab: text + font properties ───────────────────────
  await page.getByRole('button', { name: 'Label' }).click();
  await page.waitForTimeout(300);

  // Displayed text
  await page.getByRole('textbox', { name: 'displayed text' }).fill(LABEL_TEXT);

  // Font size
  await page.locator('app-font-selector')
    .getByRole('button').filter({ hasText: 'edit' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('spinbutton').first().fill(String(FONT_SIZE));
  await page.getByRole('spinbutton').first().press('Enter');
  await page.waitForTimeout(200);

  // Font color — click the hex textbox to expand the colour picker, then fill
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
  // Click via evaluate — virtual-scroll table may not expose the row to Playwright
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
