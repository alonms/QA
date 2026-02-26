// @ts-check
import { test, expect } from '@playwright/test';
import { loginAndSetup } from './helpers/login.mjs';

const SCENE_NAME = `embedded rss ${Date.now() % 10000}`;

// ── Enter Sandman lyrics (pairs: title / description) ────────
const LYRICS = [
  { title: 'Say your prayers little one',   desc: 'Dont forget my son' },
  { title: 'To include everyone',           desc: 'I tuck you in warm within' },
  { title: 'Keep you free from sin',        desc: 'Till the Sandman he comes' },
  { title: 'Sleep with one eye open',       desc: 'Gripping your pillow tight' },
  { title: 'Exit light',                    desc: 'Enter night' },
  { title: 'Take my hand',                  desc: 'Were off to never-never land' },
];

// ── helpers (same as add-rss-to-scene) ───────────────────────

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
  const closePos = await page.evaluate(({ sectionText }) => {
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
      if (btn) { const br = btn.getBoundingClientRect(); btn.click(); return { x: Math.round(br.x + br.width / 2), y: Math.round(br.y + br.height / 2) }; }
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

test('add embedded RSS with Enter Sandman lyrics', async ({ page }) => {
  test.setTimeout(180000);
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

  // ─── Layout: X=100, Y=200, width=800, height=800 ─────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);
  await setNumericField(page, 'X', 100);
  await setNumericField(page, 'Y', 200);
  await setNumericField(page, 'width', 800);
  await setNumericField(page, 'height', 800);

  // ─── Open RSS tab ─────────────────────────────────────────────
  await page.getByRole('button', { name: 'RSS' }).click();
  await page.waitForTimeout(500);

  // ─── Feed type → "embedded" ───────────────────────────────────
  // First scroll the feed type combobox into view
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')]
      .find(s => s.children.length === 0 && s.textContent?.trim() === 'feed type'
        && s.getBoundingClientRect().x > 1200);
    el?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);

  // Click "feed type" combobox and select "Embedded"
  const feedTypeCombo = page.getByRole('combobox', { name: 'feed type' });
  await feedTypeCombo.click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: /embedded/i }).click();
  await page.waitForTimeout(500);

  // ─── Direction → vertical ─────────────────────────────────────
  await page.getByRole('radio', { name: 'vertical' }).click();
  await page.waitForTimeout(300);

  // ─── Speed → 50 ──────────────────────────────────────────────
  await setNumericField(page, 'speed', 50);

  // ─── RSS title font size → 36, color red, font Arvo ──────────
  await setFontSize(page, 'RSS title', 36);
  await setFontColor(page, 'RSS title', '#ff0000');
  await setFontFamily(page, 'RSS title', 'Arvo');

  // ─── Scroll to RSS details ────────────────────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')]
      .find(s => s.children.length === 0 && s.textContent?.trim() === 'RSS details'
        && s.getBoundingClientRect().x > 1200);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(500);

  // ─── RSS details font size → 28, color blue, font Arvo ───────
  await setFontSize(page, 'RSS details', 28);
  await setFontColor(page, 'RSS details', '#0000ff');
  await setFontFamily(page, 'RSS details', 'Arvo');

  // ─── Scroll to embedded feed section ──────────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')]
      .find(s => s.children.length === 0 && s.textContent?.trim().toLowerCase().includes('embedded')
        && s.getBoundingClientRect().x > 1200);
    el?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);

  // ─── Helper: scroll embedded section into view ─────────────────
  async function scrollToEmbedded() {
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('*')]
        .find(s => s.children.length === 0 && s.textContent?.trim() === 'embedded RSS feed'
          && s.getBoundingClientRect().x > 1200);
      el?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(300);
  }

  // ─── Helper: get all row info (edit icon positions by row index) ──
  async function getRowEditIcons() {
    return page.evaluate(() => {
      const section = [...document.querySelectorAll('*')]
        .find(s => s.children.length === 0 && s.textContent?.trim() === 'embedded RSS feed'
          && s.getBoundingClientRect().x > 1200);
      if (!section) return [];
      const sY = section.getBoundingClientRect().y;
      const icons = document.querySelectorAll('mat-icon');
      const editIcons = [];
      for (const icon of icons) {
        if (icon.textContent?.trim() === 'edit') {
          const r = icon.getBoundingClientRect();
          if (r.x > 1200 && r.y > sY && r.y - sY < 600) {
            editIcons.push({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
          }
        }
      }
      editIcons.sort((a, b) => a.y - b.y);
      return editIcons;
    });
  }

  // ─── Helper: click the "+" button to add a new row ───────────────
  async function clickAddRow() {
    const pos = await page.evaluate(() => {
      const section = [...document.querySelectorAll('*')]
        .find(s => s.children.length === 0 && s.textContent?.trim() === 'embedded RSS feed'
          && s.getBoundingClientRect().x > 1200);
      if (!section) return null;
      const sY = section.getBoundingClientRect().y;
      const icons = document.querySelectorAll('mat-icon');
      for (const icon of icons) {
        if (icon.textContent?.trim() === 'add') {
          const r = icon.getBoundingClientRect();
          if (r.x > 1200 && r.y > sY && r.y - sY < 100) {
            const btn = icon.closest('button, [role="button"]') || icon.parentElement;
            const br = btn.getBoundingClientRect();
            return { x: Math.round(br.x + br.width / 2), y: Math.round(br.y + br.height / 2) };
          }
        }
      }
      return null;
    });
    if (!pos) throw new Error('Add (+) button not found');
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(500);
  }

  // ─── Helper: click a row by index (using drag_indicator icons) ────
  async function clickRow(rowIndex) {
    const pos = await page.evaluate((idx) => {
      const section = [...document.querySelectorAll('*')]
        .find(s => s.children.length === 0 && s.textContent?.trim() === 'embedded RSS feed'
          && s.getBoundingClientRect().x > 1200);
      if (!section) return null;
      const sY = section.getBoundingClientRect().y;
      const icons = document.querySelectorAll('mat-icon');
      const rows = [];
      for (const icon of icons) {
        if (icon.textContent?.trim() === 'drag_indicator') {
          const r = icon.getBoundingClientRect();
          if (r.x > 1200 && r.y > sY && r.y - sY < 600) {
            rows.push({ x: Math.round(r.x + 50), y: Math.round(r.y + r.height / 2) });
          }
        }
      }
      rows.sort((a, b) => a.y - b.y);
      return rows[idx] ?? null;
    }, rowIndex);
    if (!pos) throw new Error(`Row ${rowIndex} not found`);
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(300);
  }

  // ─── Helper: click the check/done icon to save the row edit ───────
  async function clickCheckIcon(nearY) {
    const pos = await page.evaluate((targetY) => {
      const icons = document.querySelectorAll('mat-icon');
      let best = null, bestDist = Infinity;
      for (const icon of icons) {
        const t = icon.textContent?.trim();
        if (t === 'check' || t === 'done') {
          const r = icon.getBoundingClientRect();
          if (r.x > 1200) {
            const dist = Math.abs(r.y - targetY);
            if (dist < bestDist) { bestDist = dist; best = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; }
          }
        }
      }
      return best;
    }, nearY);
    if (!pos) throw new Error('Check icon not found');
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(500);
  }

  // ─── Fill 6 rows of Enter Sandman lyrics ──────────────────────
  for (let i = 0; i < LYRICS.length; i++) {
    const { title, desc } = LYRICS[i];

    await scrollToEmbedded();

    if (i > 0) {
      await clickAddRow();
      await clickRow(i);
    }

    // Get the edit icon positions — click the one at index i
    const editIcons = await getRowEditIcons();
    if (!editIcons[i]) throw new Error(`Edit icon for row ${i} not found`);
    await page.mouse.click(editIcons[i].x, editIcons[i].y);
    await page.waitForTimeout(500);

    // Find the two text inputs that appeared in edit mode
    const rowY = editIcons[i].y;

    const inputPositions = await page.evaluate((targetY) => {
      const section = [...document.querySelectorAll('*')]
        .find(s => s.children.length === 0 && s.textContent?.trim() === 'embedded RSS feed'
          && s.getBoundingClientRect().x > 1200);
      if (!section) return [];
      const sY = section.getBoundingClientRect().y;
      // Search for ALL input types, not just type="text"
      const inputs = document.querySelectorAll('input, textarea');
      const candidates = [];
      for (const inp of inputs) {
        const r = inp.getBoundingClientRect();
        if (r.x > 1200 && r.y > sY && Math.abs(r.y - targetY) < 50 && r.width > 20) {
          candidates.push({
            x: Math.round(r.x + r.width / 2),
            y: Math.round(r.y + r.height / 2),
            left: Math.round(r.x),
            tag: inp.tagName,
            type: inp.getAttribute('type'),
            name: inp.getAttribute('name'),
          });
        }
      }
      candidates.sort((a, b) => a.left - b.left);
      return candidates;
    }, rowY);


    if (inputPositions.length < 1) {
      throw new Error(`No inputs found for row ${i}`);
    }

    // Use Playwright locators to fill both inline-edit-input fields
    const inlineInputs = page.locator('input.inline-edit-input');
    const inlineCount = await inlineInputs.count();

    // Find the two inputs nearest to our row Y
    const inputsByRow = [];
    for (let j = 0; j < inlineCount; j++) {
      const box = await inlineInputs.nth(j).boundingBox();
      if (box && Math.abs(box.y - (rowY - 12)) < 40 && box.x > 1200) {
        inputsByRow.push({ idx: j, x: box.x });
      }
    }
    inputsByRow.sort((a, b) => a.x - b.x);


    // Fill title (first input in the row)
    if (inputsByRow.length >= 1) {
      const titleInput = inlineInputs.nth(inputsByRow[0].idx);
      await titleInput.click();
      await titleInput.fill(title);
      await page.waitForTimeout(200);
    }

    // Fill description (second input in the row)
    if (inputsByRow.length >= 2) {
      const descInput = inlineInputs.nth(inputsByRow[1].idx);
      await descInput.click();
      await descInput.fill(desc);
      await page.waitForTimeout(200);
    }


    // Click check icon to save
    await clickCheckIcon(rowY);
  }

  // ─── Save ─────────────────────────────────────────────────────
  await page.locator('.center-items > button:nth-child(3)').click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10000 });
});
