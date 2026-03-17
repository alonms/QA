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

async function setFontSize(page, sectionText, value) {
  await page.evaluate((text) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === text) {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) { el.scrollIntoView({ block: 'center' }); return; }
      }
    }
  }, sectionText);
  await page.waitForTimeout(300);
  const countBefore = await page.getByRole('spinbutton').count();
  const btnPos = await page.evaluate(({ sectionText }) => {
    let sectionY = null;
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === sectionText) {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) { sectionY = r.y; break; }
      }
    }
    if (sectionY === null) return null;
    const candidates = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'font size') {
        const r = el.getBoundingClientRect();
        if (r.x > 1200 && r.y > sectionY) candidates.push({ el, y: r.y, dist: r.y - sectionY });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const target = candidates[0];
    if (!target) return null;
    let node = target.el.parentElement;
    for (let i = 0; i < 5; i++) {
      const btn = node?.querySelector('button');
      if (btn) {
        btn.scrollIntoView({ block: 'center' });
        btn.click();
        const br = btn.getBoundingClientRect();
        return { x: Math.round(br.x + br.width / 2), y: Math.round(br.y + br.height / 2) };
      }
      node = node?.parentElement ?? null;
    }
    return null;
  }, { sectionText });
  if (!btnPos) throw new Error(`Font size edit button not found for "${sectionText}"`);
  await page.waitForTimeout(300);
  if (await page.getByRole('spinbutton').count() <= countBefore) {
    await page.mouse.click(btnPos.x, btnPos.y);
    await page.waitForTimeout(300);
  }
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
  await spins.nth(bestIdx).fill(String(value));
  await spins.nth(bestIdx).press('Enter');
  await page.waitForTimeout(300);
  await page.evaluate(({ sectionText }) => {
    let sectionY = null;
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === sectionText) {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) { sectionY = r.y; break; }
      }
    }
    if (sectionY === null) return;
    for (const icon of document.querySelectorAll('mat-icon')) {
      if (icon.textContent?.trim() === 'close') {
        const r = icon.getBoundingClientRect();
        if (r.x > 1200 && r.y > sectionY && r.y - sectionY < 200) {
          const btn = icon.closest('button');
          if (btn) { btn.click(); return; }
        }
      }
    }
  }, { sectionText });
  await page.waitForTimeout(300);
}

async function setFontColor(page, sectionText, hexColor) {
  await page.evaluate((text) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === text) {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) { el.scrollIntoView({ block: 'center' }); return; }
      }
    }
  }, sectionText);
  await page.waitForTimeout(300);
  const result = await page.evaluate(({ sectionText, hexColor }) => {
    let sectionY = null;
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === sectionText) {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) { sectionY = r.y; break; }
      }
    }
    if (sectionY === null) return 'section not found';
    const colorDisplays = document.querySelectorAll('.color-display');
    let target = null, bestDist = Infinity;
    for (const inp of colorDisplays) {
      const r = inp.getBoundingClientRect();
      if (r.y > sectionY) { const dist = r.y - sectionY; if (dist < bestDist) { bestDist = dist; target = inp; } }
    }
    if (!target) return 'color input not found';
    const changeListeners = target.__zone_symbol__colorPickerChangefalse;
    const closedListeners = target.__zone_symbol__cpClosedfalse;
    if (!changeListeners?.length || !closedListeners?.length) return 'handlers not found';
    const changeHandler = changeListeners[0].callback('__ngUnwrap__');
    const closedHandler = closedListeners[0].callback('__ngUnwrap__');
    changeHandler(hexColor);
    target.value = hexColor;
    target.style.background = hexColor;
    closedHandler(hexColor);
    return 'ok';
  }, { sectionText, hexColor });
  if (result !== 'ok') throw new Error(`setFontColor failed for "${sectionText}": ${result}`);
  await page.waitForTimeout(300);
}

async function setFontFamily(page, sectionText, fontName) {
  const sectionY = await page.evaluate((text) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === text) {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) return r.y;
      }
    }
    return null;
  }, sectionText);
  if (sectionY === null) throw new Error(`Section "${sectionText}" not found`);
  const comboboxes = page.locator('input[name="fontFamily"][role="combobox"]');
  const comboCount = await comboboxes.count();
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < comboCount; i++) {
    const box = await comboboxes.nth(i).boundingBox();
    if (box && box.y > sectionY) { const dist = box.y - sectionY; if (dist < bestDist) { bestDist = dist; bestIdx = i; } }
  }
  const combo = comboboxes.nth(bestIdx);
  await combo.click();
  await combo.fill('');
  await combo.type(fontName, { delay: 50 });
  await page.waitForTimeout(500);
  const option = page.getByRole('option', { name: fontName });
  if (await option.count() > 0) {
    await option.first().click();
  } else {
    await combo.press('Enter');
  }
  await page.waitForTimeout(300);
}

// ─────────────────────────────────────────────────────────────

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

  // ─── Drag Clock component from toolbox onto the canvas ───────
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Clock') {
        const r = el.getBoundingClientRect();
        if (r.x < 700 && r.width > 10) { el.scrollIntoView({ block: 'center' }); return; }
      }
    }
  });
  await page.waitForTimeout(500);

  const dragSrc = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Clock') {
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

  await page.mouse.click(dropTgt.x, dropTgt.y);
  await page.waitForTimeout(500);

  await expect(page.getByRole('button', { name: 'layout' })).toBeVisible({ timeout: 5000 });

  // ─── Layout: set width and height ────────────────────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);

  await setNumericField(page, 'width', CLOCK_WIDTH);
  await setNumericField(page, 'height', CLOCK_HEIGHT);

  // ─── Clock tab: type, mask, and font properties ──────────────
  await page.getByRole('button', { name: 'Clock' }).click();
  await page.waitForTimeout(300);

  // Set type to "date" then "custom"
  await page.getByRole('combobox', { name: 'type' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: 'date', exact: true }).click();
  await page.waitForTimeout(300);

  await page.getByRole('combobox', { name: 'type' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: 'custom' }).click();
  await page.waitForTimeout(300);

  // Set mask
  await page.getByRole('textbox', { name: 'mask' }).fill(CLOCK_MASK);
  await page.waitForTimeout(300);

  // Font size, color, family
  await setFontSize(page, 'font settings', FONT_SIZE);
  await setFontColor(page, 'font settings', FONT_COLOR);
  await setFontFamily(page, 'font settings', FONT_NAME);

  // ─── Drag second Clock component ─────────────────────────────
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Re-open components panel
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'components') {
        const r = el.getBoundingClientRect();
        if (r.x < 200) { el.click(); return; }
      }
    }
  });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Clock') {
        const r = el.getBoundingClientRect();
        if (r.x < 700 && r.width > 10) { el.scrollIntoView({ block: 'center' }); return; }
      }
    }
  });
  await page.waitForTimeout(500);

  const dragSrc2 = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Clock') {
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
  if (!dragSrc2) throw new Error('Clock component not found in toolbox (2nd drag)');

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

  await page.mouse.click(dropTgt2.x, dropTgt2.y);
  await page.waitForTimeout(500);

  await expect(page.getByRole('button', { name: 'layout' })).toBeVisible({ timeout: 5000 });

  // ─── Layout: set width and height (2nd clock) ─────────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);

  await setNumericField(page, 'width', CLOCK_WIDTH);
  await setNumericField(page, 'height', CLOCK_HEIGHT);

  // ─── Clock tab: set type to date_time + font properties ───────
  await page.getByRole('button', { name: 'Clock' }).click();
  await page.waitForTimeout(300);

  await page.getByRole('combobox', { name: 'type' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: 'date_time' }).click();
  await page.waitForTimeout(300);

  // Font size, color, family (2nd clock)
  await setFontSize(page, 'font settings', FONT_SIZE);
  await setFontColor(page, 'font settings', FONT_COLOR);
  await setFontFamily(page, 'font settings', FONT_NAME);

  // ─── Save ─────────────────────────────────────────────────────
  await page.mouse.click(700, 400);
  await page.waitForTimeout(300);
  await page.keyboard.press('Alt+s');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10000 });
});
