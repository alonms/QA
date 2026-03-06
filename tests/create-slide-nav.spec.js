// @ts-check
import { test, expect } from '@playwright/test';
import { loginAndSetup } from './helpers/login.mjs';

const SCENE_NAME = `slide nav ${Date.now() % 10000}`;

test('create slide scene with nav menu, image, and scene', async ({ page }) => {
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

  // ─── Click "create slides" button (keep default 3 slides) ─────
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

  // ─── Navigational style should be "slide" (default) ───────────
  // Verify it's on "slide" mode already
  await page.waitForTimeout(500);

  // ─── Go to "show base layer (common)" ─────────────────────────
  await page.evaluate(() => {
    const btn = document.querySelector('button[title="show base layer (common)"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(2000);

  // ─── Add navigation menu with size "x4" ───────────────────────
  // Find the mat-select closest to "add navigation menu" label (not the action buttons one)
  await page.evaluate(() => {
    // First find the y position of "add navigation menu" text
    let navMenuY = null;
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'add navigation menu') {
        const r = el.getBoundingClientRect();
        if (r.x > 1200 && r.width > 0) { navMenuY = r.y; break; }
      }
    }
    if (!navMenuY) return;
    // Find the mat-select closest below the "add navigation menu" label
    const selects = document.querySelectorAll('mat-select');
    let bestSel = null, bestDist = Infinity;
    for (const sel of selects) {
      const r = sel.getBoundingClientRect();
      if (r.x > 1200 && r.width > 0) {
        const dist = r.y - navMenuY;
        if (dist > 0 && dist < 100 && dist < bestDist) {
          bestDist = dist;
          bestSel = sel;
        }
      }
    }
    if (bestSel) bestSel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(1000);

  // Select "x4" from the dropdown options (text is "x4 (large)")
  await page.evaluate(() => {
    const options = document.querySelectorAll('mat-option');
    for (const opt of options) {
      if (/x4/i.test(opt.textContent ?? '')) {
        opt.click();
        return;
      }
    }
  });
  await page.waitForTimeout(500);

  // Click "add menu" button
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'add menu') {
        const btn = el.closest('button') || el;
        btn.click();
        return;
      }
    }
  });
  await page.waitForTimeout(2000);

  // ─── Go back to slides view ───────────────────────────────────
  // Click the "show base layer" button again to toggle back, or find another way
  await page.evaluate(() => {
    const btn = document.querySelector('button[title*="base layer"], button[title*="slides"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);

  // If not back on slides, look for a button to return
  const onSlides = await page.evaluate(() => {
    const thumbs = document.querySelectorAll('div.slide-thumb');
    return thumbs.length > 0;
  });
  if (!onSlides) {
    // Try clicking the button that was "move_up" — it might now say "move_down" or similar
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        const title = btn.getAttribute('title') || '';
        if (title.includes('slide') || title.includes('back')) {
          btn.click();
          return;
        }
        // Also try the move_down icon
        const icon = btn.querySelector('mat-icon');
        if (icon && icon.textContent?.trim() === 'move_down') {
          btn.click();
          return;
        }
      }
    });
    await page.waitForTimeout(1000);
  }

  // ─── Slide 1: Add image from resources ────────────────────────
  // Click slide 1 thumbnail
  const slide1Box = await page.evaluate(() => {
    const thumbs = document.querySelectorAll('div.slide-thumb');
    if (thumbs.length >= 1) {
      const r = thumbs[0].getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return null;
  });
  if (slide1Box) await page.mouse.click(slide1Box.x, slide1Box.y);
  await page.waitForTimeout(500);

  // Open "resources" sidebar (7th icon from top, ~y=523)
  await page.mouse.click(1885, 523);
  await page.waitForTimeout(2000);

  // Click the first image's add icon (control_point)
  await page.evaluate(() => {
    for (const icon of document.querySelectorAll('mat-icon')) {
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

  // ─── Slide 2: Add a scene ─────────────────────────────────────
  // Click slide 2 thumbnail
  const slide2Box = await page.evaluate(() => {
    const thumbs = document.querySelectorAll('div.slide-thumb');
    if (thumbs.length >= 2) {
      const r = thumbs[1].getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return null;
  });
  if (slide2Box) await page.mouse.click(slide2Box.x, slide2Box.y);
  await page.waitForTimeout(500);

  // Open "scenes" sidebar (6th icon from top, ~y=454)
  await page.mouse.click(1885, 454);
  await page.waitForTimeout(2000);

  // Click add_circle_outline for the first scene in the list
  await page.evaluate(() => {
    for (const icon of document.querySelectorAll('mat-icon')) {
      if (icon.textContent?.trim() === 'add_circle_outline') {
        const r = icon.getBoundingClientRect();
        if (r.x > 1180 && r.y > 200 && r.width > 0) {
          icon.click();
          return;
        }
      }
    }
  });
  await page.waitForTimeout(2000);

  // ─── Save ──────────────────────────────────────────────────────
  await page.keyboard.press('Alt+s');
  await page.waitForTimeout(3000);

  // Verify save
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

  // ─── Preview the scene ───────────────────────────────────────
  // Click "preview slider" button (play_circle icon in slides panel)
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.getAttribute('title') === 'preview slider') {
        btn.click();
        return;
      }
    }
  });
  await page.waitForTimeout(3000);

  // Set preview size to percentage 75%
  // Click the "percentage" radio button
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'percentage') {
        const radio = el.closest('mat-radio-button') || el.closest('label') || el;
        radio.click();
        return;
      }
    }
  });
  await page.waitForTimeout(500);

  // Open the percent dropdown and select 75%
  await page.evaluate(() => {
    const selects = document.querySelectorAll('mat-select');
    for (const sel of selects) {
      const r = sel.getBoundingClientRect();
      if (r.width > 0 && /100%/i.test(sel.textContent ?? '')) {
        sel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return;
      }
    }
  });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    for (const opt of document.querySelectorAll('mat-option')) {
      if (opt.textContent?.trim() === '75%') {
        opt.click();
        return;
      }
    }
  });
  await page.waitForTimeout(500);

  // Click "web preview" button to launch preview in new tab
  const [previewPage] = await Promise.all([
    page.context().waitForEvent('page', { timeout: 15000 }),
    page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (/web preview/i.test(btn.textContent ?? '')) {
          btn.click();
          return;
        }
      }
    }),
  ]);

  // Wait for preview page to load
  await previewPage.waitForLoadState('domcontentloaded');
  await previewPage.waitForTimeout(8000);

  // Verify Slide 1 is showing (nav menu visible with 3 slides)
  const slide1Visible = await previewPage.evaluate(() => {
    for (const el of document.querySelectorAll('div')) {
      if (el.textContent?.trim() === 'Slide 1' && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) return true;
      }
    }
    return false;
  });
  expect(slide1Visible).toBe(true);

  // ─── Navigate to Slide 2 ────────────────────────────────────
  await previewPage.evaluate(() => {
    for (const el of document.querySelectorAll('div')) {
      if (el.textContent?.trim() === 'Slide 2' && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) { el.click(); return; }
      }
    }
  });
  await previewPage.waitForTimeout(3000);

  // ─── Navigate to Slide 3 ────────────────────────────────────
  await previewPage.evaluate(() => {
    for (const el of document.querySelectorAll('div')) {
      if (el.textContent?.trim() === 'Slide 3' && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) { el.click(); return; }
      }
    }
  });
  await previewPage.waitForTimeout(3000);

  // ─── Navigate back to Slide 1 ───────────────────────────────
  await previewPage.evaluate(() => {
    for (const el of document.querySelectorAll('div')) {
      if (el.textContent?.trim() === 'Slide 1' && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) { el.click(); return; }
      }
    }
  });
  await previewPage.waitForTimeout(3000);

  // Close preview tab
  await previewPage.close();
});
