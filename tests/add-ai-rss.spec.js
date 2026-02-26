// @ts-check
import { test, expect } from '@playwright/test';
import { loginAndSetup } from './helpers/login.mjs';

const SCENE_NAME = `ai rss ${Date.now() % 10000}`;

// ── helpers (copied from add-embedded-rss) ─────────────────

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
  const spin = spins.nth(bestIdx);
  await spin.fill(String(value));
  await spin.press('Enter');
  await page.waitForTimeout(300);
  await page.evaluate(({ sectionText }) => {
    let sectionY = null;
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === sectionText) {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) { sectionY = r.y; break; }
      }
    }
    if (sectionY === null) return null;
    const icons = document.querySelectorAll('mat-icon');
    let bestIcon = null, bestDist = Infinity;
    for (const icon of icons) {
      if (icon.textContent?.trim() === 'close') {
        const r = icon.getBoundingClientRect();
        if (r.x > 1200 && r.y > sectionY) {
          const dist = r.y - sectionY;
          if (dist < bestDist && dist < 200) { bestDist = dist; bestIcon = icon; }
        }
      }
    }
    if (bestIcon) {
      const btn = bestIcon.closest('button');
      if (btn) { btn.click(); }
    }
    return null;
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

test('add AI RSS feed with rock bands prompt', async ({ page }) => {
  test.setTimeout(300000);
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

  // Click "create scene" button inside dialog — use evaluate as fallback
  const createBtn = page.locator('mat-dialog-container button', { hasText: /create scene/i });
  if (await createBtn.count() > 0) {
    await createBtn.click({ force: true, timeout: 5000 }).catch(() => {});
  }
  // Fallback: find and click via evaluate
  await page.waitForTimeout(300);
  if (!(await page.getByText('toolbox').isVisible().catch(() => false))) {
    await page.evaluate(() => {
      const dialog = document.querySelector('mat-dialog-container');
      if (!dialog) return;
      for (const btn of dialog.querySelectorAll('button')) {
        if (/create scene/i.test(btn.textContent ?? '')) {
          btn.click();
          return;
        }
      }
    });
  }

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

  // ─── Layout: X=360, Y=100, width=1280, height=800 ─────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);
  await setNumericField(page, 'X', 360);
  await setNumericField(page, 'Y', 100);
  await setNumericField(page, 'width', 1280);
  await setNumericField(page, 'height', 800);

  // ─── Open RSS tab ─────────────────────────────────────────────
  await page.getByRole('button', { name: 'RSS' }).click();
  await page.waitForTimeout(500);

  // ─── Click "AI feed" tab ──────────────────────────────────────
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('span')) {
      if (el.textContent?.trim() === 'AI feed') {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) {
          const clickable = el.closest('button, a, [role="tab"], mat-button-toggle') || el.parentElement || el;
          clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return;
        }
      }
    }
  });
  await page.waitForTimeout(1000);

  // ─── Direction → vertical ─────────────────────────────────────
  await page.getByRole('radio', { name: 'vertical' }).click();
  await page.waitForTimeout(300);

  // ─── RSS title font: Calibri, size 36, color yellow ───────────
  await setFontSize(page, 'RSS title', 36);
  await setFontColor(page, 'RSS title', '#ffff00');
  await setFontFamily(page, 'RSS title', 'Calibri');

  // ─── Scroll to RSS details ────────────────────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')]
      .find(s => s.children.length === 0 && s.textContent?.trim() === 'RSS details'
        && s.getBoundingClientRect().x > 1200);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(500);

  // ─── RSS details font: Calibri, size 32, color green ──────────
  await setFontSize(page, 'RSS details', 32);
  await setFontColor(page, 'RSS details', '#00ff00');
  await setFontFamily(page, 'RSS details', 'Calibri');

  // ─── Scroll back up to AI feed section ─────────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('span')]
      .find(s => s.textContent?.trim() === 'create with ai'
        && s.getBoundingClientRect().x > 1200);
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);

  // ─── Fill "request feed" prompt ─────────────────────────────────
  // The "request feed" textarea is below the "create with ai" button
  const requestFeedField = page.locator('textarea').filter({ has: page.locator(':scope') });
  const textareas = page.locator('textarea:visible');
  const taCount = await textareas.count();
  let feedTextarea = null;
  for (let i = 0; i < taCount; i++) {
    const box = await textareas.nth(i).boundingBox();
    if (box && box.x > 1200) {
      feedTextarea = textareas.nth(i);
      break;
    }
  }

  if (!feedTextarea) {
    // Maybe it's a mat-form-field input, try finding by label
    const feedInput = page.locator('textarea, input').filter({ has: page.locator(':scope') });
    const allInputs = page.locator('textarea:visible, input[type="text"]:visible');
    const count = await allInputs.count();
    for (let i = 0; i < count; i++) {
      const box = await allInputs.nth(i).boundingBox();
      if (box && box.x > 1200 && box.y > 450) {
        feedTextarea = allInputs.nth(i);
        break;
      }
    }
  }

  if (!feedTextarea) throw new Error('Request feed textarea not found');
  await feedTextarea.click();
  await feedTextarea.fill('list the top 20 rock bands of all time based on record sales');
  await page.waitForTimeout(500);

  // ─── Click "create with ai" button ──────────────────────────────
  const aiBtn = await page.evaluate(() => {
    for (const el of document.querySelectorAll('span')) {
      if (el.textContent?.trim() === 'create with ai') {
        const r = el.getBoundingClientRect();
        if (r.x > 1200) {
          const btn = el.closest('button, a, [role="button"]') || el.parentElement;
          const br = btn.getBoundingClientRect();
          return { x: Math.round(br.x + br.width / 2), y: Math.round(br.y + br.height / 2) };
        }
      }
    }
    return null;
  });
  if (!aiBtn) throw new Error('Create with AI button not found');
  await page.mouse.click(aiBtn.x, aiBtn.y);
  await page.waitForTimeout(3000);

  // ─── AI wizard dialog: step 1 (prompt) → click Next ─────────────
  // The dialog "ai wizard (rss)" has a stepper: 1.prompt → 2.preview
  // The prompt textarea is pre-filled from the "request feed" field in the panel.
  // Click the "next" button to advance to the preview step and trigger AI generation.
  const nextBtn = await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container');
    if (!dialog) return null;
    for (const btn of dialog.querySelectorAll('button')) {
      const text = btn.textContent?.trim().toLowerCase() ?? '';
      if (text.includes('next')) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
    }
    return null;
  });
  if (!nextBtn) throw new Error('"next" button not found in AI wizard dialog');
  await page.mouse.click(nextBtn.x, nextBtn.y);
  await page.waitForTimeout(3000);

  // ─── AI wizard: step 2 (preview) — wait for generation ──────────
  // "loading preview data..." shows with spinner. Wait for it to disappear.
  for (let attempt = 0; attempt < 90; attempt++) {
    await page.waitForTimeout(2000);
    const state = await page.evaluate(() => {
      const dialog = document.querySelector('mat-dialog-container');
      if (!dialog) return { state: 'dialog_closed' };

      // Check for "loading" text in dialog
      const dialogText = dialog.textContent?.toLowerCase() ?? '';
      const isLoading = dialogText.includes('loading');

      // Check for visible spinner
      const spinners = dialog.querySelectorAll('mat-spinner, mat-progress-spinner, [class*="spinner"]');
      const hasSpinner = [...spinners].some(s => {
        const r = s.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      // Check if apply button exists and is NOT disabled
      for (const btn of dialog.querySelectorAll('button')) {
        const t = btn.textContent?.trim().toLowerCase() ?? '';
        if (t.includes('apply')) {
          const isDisabled = btn.disabled || btn.classList.contains('mat-button-disabled');
          if (!isDisabled && !isLoading && !hasSpinner) {
            return { state: 'ready' };
          }
          return { state: 'loading', disabled: isDisabled, loadingText: isLoading, spinner: hasSpinner };
        }
      }

      if (isLoading || hasSpinner) return { state: 'loading' };
      return { state: 'waiting' };
    });

    if (state.state === 'ready') break;
    if (state.state === 'dialog_closed') break;
    if (attempt === 89) throw new Error('AI generation timed out after 180s');
  }

  // ─── Click apply/save/done in the dialog ──────────────────────────
  const applyBtn = await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container');
    if (!dialog) return null;
    const candidates = ['apply', 'done', 'accept', 'save', 'use'];
    for (const btn of dialog.querySelectorAll('button')) {
      const t = btn.textContent?.trim().toLowerCase() ?? '';
      for (const c of candidates) {
        if (t.includes(c)) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text: btn.textContent?.trim() };
        }
      }
    }
    return null;
  });

  if (applyBtn) {
    await page.mouse.click(applyBtn.x, applyBtn.y);
    await page.waitForTimeout(2000);
  }

  // Wait for dialog to close
  for (let i = 0; i < 10; i++) {
    const dialogOpen = await page.evaluate(() => {
      const d = document.querySelector('mat-dialog-container');
      return d ? d.getBoundingClientRect().width > 0 : false;
    });
    if (!dialogOpen) break;
    await page.waitForTimeout(500);
  }

  // ─── Save ─────────────────────────────────────────────────────
  await page.locator('.center-items > button:nth-child(3)').click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10000 });
});
