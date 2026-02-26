// @ts-check
import { test, expect } from '@playwright/test';
import { loginAndSetup } from './helpers/login.mjs';

const SCENE_NAME = `rss scene ${Date.now() % 10000}`;

// ── configurable RSS properties ──────────────────────────────
const RSS_X       = 320;
const RSS_Y       = 100;
const RSS_WIDTH   = 1280;
const RSS_HEIGHT  = 720;
const FEED        = 'World News';
const SPEED       = 50;
const TITLE_FONT_SIZE    = 36;
const TITLE_FONT_COLOR   = '#ff0000';
const TITLE_FONT_FAMILY  = 'Calibri';
const DETAILS_FONT_SIZE  = 28;
const DETAILS_FONT_COLOR = '#0000ff';
// ──────────────────────────────────────────────────────────────

/**
 * Finds the DropNumberSelector edit button by its label text (properties panel,
 * x > 1200), clicks it with Playwright mouse to open a spinbutton, fills, Enter.
 */
async function setNumericField(page, fieldText, value) {
  const countBefore = await page.getByRole('spinbutton').count();

  // Find edit button position via evaluate, but DON'T click — return coords
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

  // Click with Playwright mouse (proper Angular change detection)
  await page.mouse.click(btnPos.x, btnPos.y);
  await page.waitForTimeout(300);

  // Wait for a new spinbutton to appear
  for (let attempt = 0; attempt < 15; attempt++) {
    await page.waitForTimeout(100);
    if (await page.getByRole('spinbutton').count() > countBefore) break;
  }

  // Find the spinbutton closest to the clicked button (by y-position)
  const spins = page.getByRole('spinbutton');
  const count = await spins.count();
  let bestIdx = count - 1;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const box = await spins.nth(i).boundingBox();
    if (box) {
      const dist = Math.abs(box.y - btnPos.y);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
  }

  const spin = spins.nth(bestIdx);
  await spin.fill(String(value));
  await spin.press('Enter');
  await page.waitForTimeout(300);

  // Close the spinbutton by clicking the edit/close toggle again
  await page.mouse.click(btnPos.x, btnPos.y);
  await page.waitForTimeout(300);
}

/**
 * Sets a DropNumberSelector font size field within a specific section.
 * Clicks the edit button, fills the spinbutton, presses Enter, then clicks
 * close to collapse it.
 */
async function setFontSize(page, sectionText, value) {
  // Scroll the section into view first
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

  // Find and click the edit button for "font size" within the section
  // scrollIntoView + get fresh coordinates + click in one step
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
        if (r.x > 1200 && r.y > sectionY) {
          candidates.push({ el, y: r.y, dist: r.y - sectionY });
        }
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const target = candidates[0];
    if (!target) return null;

    // Find and CLICK the edit button, return its position
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

  // If evaluate click didn't trigger Angular, retry with Playwright mouse
  if (await page.getByRole('spinbutton').count() <= countBefore) {
    await page.mouse.click(btnPos.x, btnPos.y);
    await page.waitForTimeout(300);
  }

  // Wait for a new spinbutton to appear
  for (let attempt = 0; attempt < 15; attempt++) {
    await page.waitForTimeout(100);
    if (await page.getByRole('spinbutton').count() > countBefore) break;
  }

  // Find the spinbutton closest to the clicked button
  const spins = page.getByRole('spinbutton');
  const count = await spins.count();
  let bestIdx = count - 1;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const box = await spins.nth(i).boundingBox();
    if (box) {
      const dist = Math.abs(box.y - btnPos.y);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
  }

  const spin = spins.nth(bestIdx);
  await spin.fill(String(value));
  await spin.press('Enter');
  await page.waitForTimeout(300);

  // Close the spinbutton (click close toggle) — get fresh position
  const closePos = await page.evaluate(({ sectionText }) => {
    let sectionY = null;
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === sectionText) {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) { sectionY = r.y; break; }
      }
    }
    if (sectionY === null) return null;
    // Find the "close" mat-icon nearest below the section header
    const icons = document.querySelectorAll('mat-icon');
    let bestIcon = null;
    let bestDist = Infinity;
    for (const icon of icons) {
      if (icon.textContent?.trim() === 'close') {
        const r = icon.getBoundingClientRect();
        if (r.x > 1200 && r.y > sectionY) {
          const dist = r.y - sectionY;
          if (dist < bestDist && dist < 200) {
            bestDist = dist;
            bestIcon = icon;
          }
        }
      }
    }
    if (bestIcon) {
      const btn = bestIcon.closest('button');
      if (btn) {
        const br = btn.getBoundingClientRect();
        btn.click();
        return { x: Math.round(br.x + br.width / 2), y: Math.round(br.y + br.height / 2) };
      }
    }
    return null;
  }, { sectionText });

  await page.waitForTimeout(300);
}

/**
 * Sets the font color for a section by invoking Angular's internal
 * colorPickerChange + cpClosed event handlers on the .color-display input.
 * The cpClosed handler is what commits the color to the model — without it
 * the value reverts on save.
 */
async function setFontColor(page, sectionText, hexColor) {
  // Scroll the section into view
  await page.evaluate((text) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === text) {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) { el.scrollIntoView({ block: 'center' }); return; }
      }
    }
  }, sectionText);
  await page.waitForTimeout(300);

  // Find the .color-display input closest below the section header
  // and call both Angular Zone.js event handlers to persist the color
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
    let target = null;
    let bestDist = Infinity;
    for (const inp of colorDisplays) {
      const r = inp.getBoundingClientRect();
      if (r.y > sectionY) {
        const dist = r.y - sectionY;
        if (dist < bestDist) { bestDist = dist; target = inp; }
      }
    }
    if (!target) return 'color input not found';

    // Access Angular's Zone.js event handlers
    const changeListeners = target.__zone_symbol__colorPickerChangefalse;
    const closedListeners = target.__zone_symbol__cpClosedfalse;
    if (!changeListeners?.length || !closedListeners?.length) return 'handlers not found';

    const changeHandler = changeListeners[0].callback('__ngUnwrap__');
    const closedHandler = closedListeners[0].callback('__ngUnwrap__');

    // Fire colorPickerChange (preview) then cpClosed (commit to model)
    changeHandler(hexColor);
    target.value = hexColor;
    target.style.background = hexColor;
    closedHandler(hexColor);

    return 'ok';
  }, { sectionText, hexColor });
  if (result !== 'ok') throw new Error(`setFontColor failed for "${sectionText}": ${result}`);

  await page.waitForTimeout(300);
}

/**
 * Sets the font family combobox closest to a section header.
 */
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

  // Find the fontFamily combobox closest below the section header
  const comboboxes = page.locator('input[name="fontFamily"][role="combobox"]');
  const comboCount = await comboboxes.count();
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < comboCount; i++) {
    const box = await comboboxes.nth(i).boundingBox();
    if (box && box.y > sectionY) {
      const dist = box.y - sectionY;
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
  }

  const combo = comboboxes.nth(bestIdx);
  await combo.click();
  await combo.fill('');
  await combo.type(fontName, { delay: 50 });
  await page.waitForTimeout(500);

  // Click the matching autocomplete option
  const option = page.getByRole('option', { name: fontName });
  if (await option.count() > 0) {
    await option.first().click();
  } else {
    await combo.press('Enter');
  }
  await page.waitForTimeout(300);
}


test('add RSS to scene and configure properties', async ({ page }) => {
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
  await page.waitForTimeout(500);
  await page.locator('mat-dialog-container button', { hasText: /create scene/i })
    .click({ force: true });

  await expect(page.getByText('toolbox')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2000);

  // ─── Drag Rss component from toolbox onto the canvas ──────────
  const dragSrc = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Rss') {
        const r = el.getBoundingClientRect();
        if (r.x < 700 && r.y > 100 && r.width > 10 && r.height > 10) {
          const drag = el.closest('[draggable="true"]') || el.parentElement;
          const dr = (drag ?? el).getBoundingClientRect();
          if (dr.x < 700)
            return { x: Math.round(dr.x + dr.width / 2), y: Math.round(dr.y + dr.height / 2) };
        }
      }
    }
    return null;
  });
  if (!dragSrc) throw new Error('Rss component not found in toolbox');

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

  // ─── Layout: set X, Y, width, height ──────────────────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);

  await setNumericField(page, 'X', RSS_X);
  await setNumericField(page, 'Y', RSS_Y);
  await setNumericField(page, 'width', RSS_WIDTH);
  await setNumericField(page, 'height', RSS_HEIGHT);

  // ─── Open RSS tab ─────────────────────────────────────────────
  await page.getByRole('button', { name: 'RSS' }).click();
  await page.waitForTimeout(500);

  // ─── Set feed to "World News" ─────────────────────────────────
  await page.getByRole('combobox', { name: 'feed', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: FEED }).click();
  await page.waitForTimeout(300);

  // ─── Set speed to 50 ─────────────────────────────────────────
  await setNumericField(page, 'speed', SPEED);

  // ─── RSS title font size ──────────────────────────────────────
  await setFontSize(page, 'RSS title', TITLE_FONT_SIZE);

  // ─── RSS title font color ────────────────────────────────────
  await setFontColor(page, 'RSS title', TITLE_FONT_COLOR);

  // ─── RSS title font family ───────────────────────────────────
  await setFontFamily(page, 'RSS title', TITLE_FONT_FAMILY);

  // ─── Scroll down to RSS details section ───────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')]
      .find(s => s.children.length === 0 && s.textContent?.trim() === 'RSS details'
        && s.getBoundingClientRect().x > 1200);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(500);

  // ─── RSS details font size ───────────────────────────────────
  await setFontSize(page, 'RSS details', DETAILS_FONT_SIZE);

  // ─── RSS details font color ──────────────────────────────────
  await setFontColor(page, 'RSS details', DETAILS_FONT_COLOR);

  // ─── Save ─────────────────────────────────────────────────────
  await page.locator('.center-items > button:nth-child(3)').click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 5000 });

  // ═══════════════════════════════════════════════════════════════
  // ─── SECOND RSS COMPONENT ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════

  // Click on empty canvas area to deselect the first component
  // Use Escape key which is more reliable than clicking
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Switch to "components" tab in toolbox to find the Rss item for dragging
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'components') {
        const r = el.getBoundingClientRect();
        if (r.x < 700) { el.click(); return; }
      }
    }
  });
  await page.waitForTimeout(500);

  // ─── Drag second Rss component from toolbox onto the canvas ───
  const dragSrc2 = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Rss') {
        const r = el.getBoundingClientRect();
        if (r.x < 700 && r.y > 100 && r.width > 10 && r.height > 10) {
          const drag = el.closest('[draggable="true"]') || el.parentElement;
          const dr = (drag ?? el).getBoundingClientRect();
          if (dr.x < 700)
            return { x: Math.round(dr.x + dr.width / 2), y: Math.round(dr.y + dr.height / 2) };
        }
      }
    }
    return null;
  });
  if (!dragSrc2) throw new Error('Rss component not found in toolbox (2nd drag)');

  const dropTgt2 = await page.evaluate(() => {
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

  // Select the NEW component via the layers panel (clicking canvas would hit the first one)
  // Click "layers" tab — find the tab element in the toolbox sidebar and click with force
  const layersTab = page.getByText('layers', { exact: true }).first();
  await layersTab.click({ force: true });
  await page.waitForTimeout(1000);

  // In layers, the second Rss from the top is the newly added component — click it
  const rss2Pos = await page.evaluate(() => {
    const rssItems = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Rss') {
        const r = el.getBoundingClientRect();
        if (r.x < 700 && r.y > 150 && r.width > 5 && r.height > 5) {
          rssItems.push({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
        }
      }
    }
    rssItems.sort((a, b) => a.y - b.y);
    // Second from top = the newly added component
    return rssItems.length >= 2 ? rssItems[1] : rssItems[0] ?? null;
  });
  if (rss2Pos) await page.mouse.click(rss2Pos.x, rss2Pos.y);
  await page.waitForTimeout(500);

  await expect(page.getByRole('button', { name: 'layout' })).toBeVisible({ timeout: 5000 });

  // ─── Layout: X=0, Y=970, width=1920, height=100 ──────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);

  await setNumericField(page, 'X', 0);
  await setNumericField(page, 'Y', 970);
  await setNumericField(page, 'width', 1920);
  await setNumericField(page, 'height', 100);

  // ─── Open RSS tab ─────────────────────────────────────────────
  await page.getByRole('button', { name: 'RSS' }).click();
  await page.waitForTimeout(500);

  // ─── Feed → "custom" ──────────────────────────────────────────
  await page.getByRole('combobox', { name: 'feed', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: 'custom' }).click();
  await page.waitForTimeout(300);

  // ─── Fill custom URL ──────────────────────────────────────────
  const urlInput = page.getByRole('textbox', { name: 'url' });
  await urlInput.click();
  await urlInput.fill('https://moxie.foxnews.com/google-publisher/sports.xml');
  await page.waitForTimeout(300);

  // ─── Direction → horizontal ───────────────────────────────────
  await page.getByRole('radio', { name: 'horizontal' }).click();
  await page.waitForTimeout(300);

  // ─── Speed → 75 ──────────────────────────────────────────────
  await setNumericField(page, 'speed', 75);

  // ─── RSS title font size → 48 ────────────────────────────────
  await setFontSize(page, 'RSS title', 48);

  // ─── RSS title font color → yellow ────────────────────────────
  await setFontColor(page, 'RSS title', '#ffff00');

  // ─── RSS title font family → "a love for thunder" ─────────────
  await setFontFamily(page, 'RSS title', 'A Love of Thunder');

  // ─── Save ─────────────────────────────────────────────────────
  await page.locator('.center-items > button:nth-child(3)').click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 5000 });
});
