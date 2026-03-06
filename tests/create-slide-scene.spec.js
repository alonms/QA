// @ts-check
import { test, expect } from '@playwright/test';
import { loginAndSetup } from './helpers/login.mjs';

const SCENE_NAME = `slide scene ${Date.now() % 10000}`;

test('create slide scene with weather and image', async ({ page }) => {
  test.setTimeout(300000);
  await loginAndSetup(page);

  // ─── Go to scenes ────────────────────────────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('span')]
      .find(e => e.textContent?.trim().toLowerCase() === 'scenes');
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForURL('**/editor/list', { timeout: 15000 });

  // ─── Open create scene dialog ─────────────────────────────────
  await page.locator('button', { hasText: /create scene/i }).click({ force: true });
  await page.waitForTimeout(1000);

  // Click "create slides" option
  await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container') || document.querySelector('[role="dialog"]');
    if (!dialog) return;
    for (const el of dialog.querySelectorAll('div')) {
      if (el.textContent?.trim() === 'create slides' && el.children.length === 0) {
        const card = el.closest('[class*="card"], [class*="option"], [class*="item"]') || el.parentElement;
        (card || el).click();
        return;
      }
    }
  });
  await page.waitForTimeout(1500);

  // ─── Fill slides name ──────────────────────────────────────────
  const nameInput = page.locator('mat-dialog-container input').first();
  await nameInput.click({ force: true, clickCount: 3 });
  await page.keyboard.press('Control+a');
  await page.keyboard.type(SCENE_NAME);
  await page.waitForTimeout(300);

  // ─── Set number of slides to 5 (default 3, click + twice) ─────
  for (let clicks = 0; clicks < 2; clicks++) {
    await page.evaluate(() => {
      const dialog = document.querySelector('mat-dialog-container');
      if (!dialog) return;
      let labelY = null;
      for (const el of dialog.querySelectorAll('*')) {
        if (el.children.length === 0 && el.textContent?.trim() === 'number of slides') {
          labelY = el.getBoundingClientRect().y;
          break;
        }
      }
      if (labelY === null) return;
      const icons = dialog.querySelectorAll('mat-icon');
      let bestIcon = null, bestDist = Infinity;
      for (const icon of icons) {
        if (icon.textContent?.trim() === 'add') {
          const r = icon.getBoundingClientRect();
          const dist = Math.abs(r.y - labelY);
          if (dist < bestDist && dist < 100) { bestDist = dist; bestIcon = icon; }
        }
      }
      if (bestIcon) (bestIcon.closest('button') || bestIcon).click();
    });
    await page.waitForTimeout(300);
  }

  // ─── Click "create slides" button ──────────────────────────────
  await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container');
    if (!dialog) return;
    for (const btn of dialog.querySelectorAll('button')) {
      if (/create slides/i.test(btn.textContent ?? '')) {
        btn.click();
        return;
      }
    }
  });

  // Wait for editor
  await page.waitForTimeout(5000);

  // If still on list, double-click the scene
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
  await page.waitForTimeout(2000);

  // ─── Set navigational style to "time" ──────────────────────────
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('span')) {
      if (el.textContent?.trim() === 'time') {
        const r = el.getBoundingClientRect();
        if (r.x > 1200 && r.y < 300) { el.click(); return; }
      }
    }
  });
  await page.waitForTimeout(1000);

  // Handle "confirm component switch" dialog if it appears
  const confirmed = await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container');
    if (!dialog) return false;
    for (const btn of dialog.querySelectorAll('button')) {
      if (/confirm/i.test(btn.textContent ?? '')) {
        btn.click();
        return true;
      }
    }
    return false;
  });
  if (confirmed) await page.waitForTimeout(2000);

  // ─── Set default duration to 10 seconds ────────────────────────
  const allInputs = page.locator('input:visible');
  const inputCount = await allInputs.count();
  let durInput = null;
  for (let i = 0; i < inputCount; i++) {
    const box = await allInputs.nth(i).boundingBox();
    if (box && box.x > 1200 && box.y > 240 && box.y < 380) {
      durInput = allInputs.nth(i);
      break;
    }
  }
  if (durInput) {
    await durInput.click({ clickCount: 3 });
    await durInput.fill('10');
    await durInput.press('Enter');
    await page.waitForTimeout(500);
  }

  // ─── Slide 1: Add weather scene ─────────────────────────────────
  // Click slide 1 thumbnail in left panel
  await page.evaluate(() => {
    const thumbs = document.querySelectorAll('div.slide-thumb');
    if (thumbs.length >= 1) thumbs[0].click();
  });
  await page.waitForTimeout(500);

  // Open "scenes" sidebar (6th icon from top in far-right sidebar, ~y=454)
  await page.mouse.click(1885, 454);
  await page.waitForTimeout(2000);

  // Filter for weather scene
  const scenesFilterInputs = page.locator('input:visible');
  const sfCount = await scenesFilterInputs.count();
  for (let i = 0; i < sfCount; i++) {
    const box = await scenesFilterInputs.nth(i).boundingBox();
    if (box && box.x > 1190 && box.y > 120 && box.y < 200) {
      await scenesFilterInputs.nth(i).click();
      await scenesFilterInputs.nth(i).fill('');
      await page.waitForTimeout(200);
      await scenesFilterInputs.nth(i).pressSequentially('weather', { delay: 50 });
      break;
    }
  }
  await page.waitForTimeout(1500);

  // Click add_circle_outline for the "weather scene" (Player type)
  await page.evaluate(() => {
    const rows = document.querySelectorAll('tr');
    for (const row of rows) {
      const tds = row.querySelectorAll('td');
      let hasWeatherScene = false;
      let hasPlayerType = false;
      for (const td of tds) {
        const text = td.textContent?.trim() || '';
        if (text.toLowerCase().startsWith('weather scene')) hasWeatherScene = true;
        if (text === 'Player') hasPlayerType = true;
      }
      if (hasWeatherScene && hasPlayerType) {
        const addIcon = row.querySelector('mat-icon');
        if (addIcon && addIcon.textContent?.trim() === 'add_circle_outline') {
          addIcon.click();
          return;
        }
      }
    }
  });
  await page.waitForTimeout(2000);

  // ─── Slide 2: Click on the second slide thumbnail ──────────────
  // Get the position of slide 2 and use mouse.click for proper event propagation
  const slide2Box = await page.evaluate(() => {
    const thumbs = document.querySelectorAll('div.slide-thumb');
    if (thumbs.length >= 2) {
      const r = thumbs[1].getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return null;
  });
  if (slide2Box) {
    await page.mouse.click(slide2Box.x, slide2Box.y);
  }
  await page.waitForTimeout(1000);

  // Open "resources" sidebar (7th icon from top, ~y=523)
  await page.mouse.click(1885, 523);
  await page.waitForTimeout(2000);

  // Click the first image's add icon (control_point) to add it to slide 2
  await page.evaluate(() => {
    const addIcons = document.querySelectorAll('mat-icon');
    for (const icon of addIcons) {
      if (icon.textContent?.trim() === 'control_point') {
        const r = icon.getBoundingClientRect();
        if (r.x > 1200 && r.y > 200 && r.width > 0) {
          (icon.closest('button') || icon).click();
          return;
        }
      }
    }
  });
  await page.waitForTimeout(2000);

  // ─── Save ──────────────────────────────────────────────────────
  await page.keyboard.press('Alt+s');
  await page.waitForTimeout(3000);

  // Verify save — look for "Saved" in status bar
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
    // Fallback: try clicking the save button directly
    await page.evaluate(() => {
      const icons = document.querySelectorAll('mat-icon');
      for (const icon of icons) {
        if (icon.textContent?.trim() === 'save') {
          const btn = icon.closest('button');
          if (btn) { btn.click(); return; }
        }
      }
      // Try the toolbar button
      const btns = document.querySelectorAll('button[mattooltip*="save"], button[aria-label*="save"]');
      if (btns.length) btns[0].click();
    });
    await page.waitForTimeout(3000);
  }
});
