// @ts-check
import { test, expect } from '@playwright/test';
import { loginAndSetup } from './helpers/login.mjs';

const SCENE_NAME = `weather scene ${Date.now() % 10000}`;

// ── configurable weather properties ──────────────────────────
const WEATHER_WIDTH   = 1280;
const WEATHER_HEIGHT  = 720;
const WEATHER_X       = 50;
const WEATHER_Y       = 50;
const SELECT_SCENE    = '7-Day Weather Horizontal Starry Night';
const ADDRESS         = 'Quezon City, Philippines';
const TEMP_UNIT       = 'C';
const STYLE           = 'Color';
// ──────────────────────────────────────────────────────────────

/**
 * Finds the DropNumberSelector edit button by label text (properties panel,
 * x > 1200), clicks it to open a spinbutton, fills, Enter, then closes.
 * Uses y-proximity to target the correct spinbutton when multiple are open.
 */
async function setNumericField(page, fieldText, value) {
  const countBefore = await page.getByRole('spinbutton').count();
  const btnPos = await page.evaluate((text) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === text) {
        const r = el.getBoundingClientRect();
        if (r.x < 1200) continue;
        let node = el.parentElement;
        for (let i = 0; i < 5; i++) {
          const btn = node?.querySelector('button');
          if (btn) {
            const br = btn.getBoundingClientRect();
            return { x: Math.round(br.x + br.width / 2), y: Math.round(br.y + br.height / 2) };
          }
          node = node?.parentElement ?? null;
        }
      }
    }
    return null;
  }, fieldText);
  if (!btnPos) throw new Error(`Edit button not found for "${fieldText}"`);
  await page.mouse.click(btnPos.x, btnPos.y);
  await page.waitForTimeout(300);
  for (let attempt = 0; attempt < 15; attempt++) {
    await page.waitForTimeout(100);
    if (await page.getByRole('spinbutton').count() > countBefore) break;
  }
  const spins = page.getByRole('spinbutton');
  const count = await spins.count();
  let bestIdx = count - 1, bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const box = await spins.nth(i).boundingBox();
    if (box) { const dist = Math.abs(box.y - btnPos.y); if (dist < bestDist) { bestDist = dist; bestIdx = i; } }
  }
  const spin = spins.nth(bestIdx);
  await spin.fill(String(value));
  await spin.press('Enter');
  await page.waitForTimeout(300);
  await page.mouse.click(btnPos.x, btnPos.y);
  await page.waitForTimeout(300);
}

test('add weather to scene and configure properties', async ({ page }) => {
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
  await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container');
    if (!dialog) return;
    for (const btn of dialog.querySelectorAll('button')) {
      if (/create scene/i.test(btn.textContent ?? '')) { btn.click(); return; }
    }
  });

  await page.waitForTimeout(5000);
  if (page.url().includes('editor/list')) {
    await page.evaluate((name) => {
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length === 0 && el.textContent?.trim() === name) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) { el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); return; }
        }
      }
    }, SCENE_NAME);
    await page.waitForTimeout(5000);
  }
  await page.waitForURL('**/editor/**', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Ensure components panel is open
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'components') {
        const r = el.getBoundingClientRect();
        if (r.x < 200) { el.click(); return; }
      }
    }
  });
  await page.waitForTimeout(1000);

  // ─── Drag Weather component from toolbox onto the canvas ─────
  // Scroll Weather into view in the toolbox
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Weather') {
        const r = el.getBoundingClientRect();
        if (r.x < 700 && r.width > 10) { el.scrollIntoView({ block: 'center' }); return; }
      }
    }
  });
  await page.waitForTimeout(500);

  const dragSrc = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Weather') {
        const r = el.getBoundingClientRect();
        if (r.x < 700 && r.y > 50 && r.y < window.innerHeight && r.width > 10 && r.height > 10) {
          const drag = el.closest('[draggable="true"]') || el.parentElement;
          const dr = (drag ?? el).getBoundingClientRect();
          if (dr.x < 700)
            return { x: Math.round(dr.x + dr.width / 2), y: Math.round(dr.y + dr.height / 2) };
        }
      }
    }
    return null;
  });
  if (!dragSrc) throw new Error('Weather component not found in toolbox');

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

  // ─── Layout: set X, Y, width, height ─────────────────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);

  await setNumericField(page, 'X', WEATHER_X);
  await setNumericField(page, 'Y', WEATHER_Y);
  await setNumericField(page, 'width', WEATHER_WIDTH);
  await setNumericField(page, 'height', WEATHER_HEIGHT);

  // ─── Weather tab: select scene, address, unit, style ─────────
  await page.getByRole('button', { name: 'Weather' }).click();
  await page.waitForTimeout(300);

  // Select scene — open the "select scene" dropdown and pick the template
  await page.getByRole('combobox', { name: 'select scene' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: SELECT_SCENE }).click();
  await page.waitForTimeout(300);

  // Address
  const addressInput = page.getByRole('textbox', { name: 'address / zip' });
  await addressInput.clear();
  await addressInput.fill(ADDRESS);
  await addressInput.press('Enter');
  await page.waitForTimeout(300);

  // Temperature unit
  await page.getByRole('combobox', { name: 'temperature unit' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: TEMP_UNIT }).click();
  await page.waitForTimeout(300);

  // Style — click the "Color" radio button
  await page.getByRole('radio', { name: STYLE }).click();
  await page.waitForTimeout(300);

  // ─── Save ─────────────────────────────────────────────────────
  // Click canvas to ensure focus is not on an input field
  await page.mouse.click(700, 400);
  await page.waitForTimeout(300);
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
