// @ts-check
import { test, expect } from '@playwright/test';
import { loginAndSetup } from './helpers/login.mjs';

const SCENE_NAME = `playlist scene ${Date.now() % 10000}`;

// ── configurable playlist properties ──────────────────────────
const PLAYLIST_WIDTH    = 1280;
const PLAYLIST_HEIGHT   = 720;
const DEFAULT_DURATION  = 10;
const BIRDS_DURATION    = 5;
// ──────────────────────────────────────────────────────────────

/**
 * Finds the numeric field by its label text, clicks its "edit" button,
 * then fills the spinbutton that appears.
 */
async function setNumericField(page, fieldText, value) {
  const before = await page.getByRole('spinbutton').count();

  await page.evaluate((text) => {
    // Find the visible label element
    let labelEl = null;
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === text) {
        const r = el.getBoundingClientRect();
        if (r.y >= 0 && r.y <= window.innerHeight && r.width > 0) {
          labelEl = el;
          break;
        }
      }
    }
    if (!labelEl) return;

    const labelRect = labelEl.getBoundingClientRect();

    // Find the nearest "edit" icon button by y-coordinate proximity
    const editBtns = [...document.querySelectorAll('button')].filter(b => {
      const icon = b.querySelector('mat-icon');
      return icon && icon.textContent?.trim() === 'edit';
    });
    let bestBtn = null;
    let bestDist = Infinity;
    for (const btn of editBtns) {
      const br = btn.getBoundingClientRect();
      if (br.y < 0 || br.y > window.innerHeight) continue;
      const dist = Math.abs(br.y - labelRect.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestBtn = btn;
      }
    }
    if (bestBtn) { bestBtn.click(); return; }

    // Fallback: walk up from label and click first button
    let node = labelEl.parentElement;
    for (let i = 0; i < 3; i++) {
      const btn = node?.querySelector('button');
      if (btn) { btn.click(); return; }
      node = node?.parentElement ?? null;
    }
  }, fieldText);
  await page.waitForTimeout(300);

  const after = await page.getByRole('spinbutton').count();
  const spin = page.getByRole('spinbutton').nth(after > before ? after - 1 : before - 1);
  await spin.fill(String(value));
  await spin.press('Enter');
  await page.waitForTimeout(300);
}

/**
 * Clicks the "add" icon (<a class="table-button"> with mat-icon "add")
 * in the playlist content toolbar to open the asset picker dialog.
 */
async function openAssetPicker(page) {
  await page.evaluate(() => {
    const links = [...document.querySelectorAll('a.table-button')];
    const addLink = links.find(a => a.querySelector('mat-icon')?.textContent?.trim() === 'add');
    addLink?.click();
  });
  await page.waitForTimeout(1000);
  await page.getByRole('dialog').waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
}

test('add playlist to scene and configure content', async ({ page }) => {
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

  // ─── Drag Playlist component from toolbox onto the canvas ────
  const dragSrc = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'Playlist') {
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
  if (!dragSrc) throw new Error('Playlist component not found in toolbox');

  // Drop at canvas centre (position will be set precisely via layout fields)
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

  // ─── Layout: set position and size ──────────────────────────
  await page.getByRole('button', { name: 'layout' }).click();
  await page.waitForTimeout(300);

  await setNumericField(page, 'width',  PLAYLIST_WIDTH);
  await setNumericField(page, 'height', PLAYLIST_HEIGHT);
  await setNumericField(page, 'X', 50);
  await setNumericField(page, 'Y', 50);

  // ─── Playlist tab ────────────────────────────────────────────
  await page.getByRole('button', { name: 'Playlist', exact: true }).click();
  await page.waitForTimeout(300);

  // Set default duration to 10
  await setNumericField(page, 'default duration', DEFAULT_DURATION);

  // ─── Add cat images from resources ───────────────────────────
  await openAssetPicker(page);

  // Click "images" radio to filter by type
  await page.getByRole('radio', { name: /images/i }).click({ force: true });
  await page.waitForTimeout(500);

  // Type "cat" to filter by name
  const filterInput = page.getByRole('textbox', { name: /filter list/i });
  await filterInput.clear();
  await filterInput.pressSequentially('cat', { delay: 50 });
  await page.waitForTimeout(2000);

  // Select all visible cat image tiles (wall/grid view)
  await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container') || document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const imgs = [...dialog.querySelectorAll('img')];
    for (const img of imgs) {
      let card = img.parentElement;
      for (let i = 0; i < 5; i++) {
        if (!card) break;
        if (card.textContent?.toLowerCase().includes('cat') && card.querySelector('img')) {
          card.click();
          break;
        }
        card = card.parentElement;
      }
    }
  });
  await page.waitForTimeout(500);

  // Click insert
  await page.getByRole('button', { name: /insert/i }).click({ force: true });
  await page.waitForTimeout(1000);

  // ─── Add "birds" scene ───────────────────────────────────────
  await openAssetPicker(page);

  // Click "scenes" tab
  await page.getByRole('tab', { name: /scenes/i }).click({ force: true });
  await page.waitForTimeout(1000);

  // Filter scenes by "birds"
  const sceneFilter = page.locator('mat-dialog-container').getByRole('textbox', { name: /filter list/i });
  await sceneFilter.clear();
  await sceneFilter.pressSequentially('birds', { delay: 50 });
  await page.waitForTimeout(2000);

  // Click the checkbox label in the "birds" row to select it
  await page.evaluate(() => {
    const dialog = document.querySelector('mat-dialog-container') || document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const rows = [...dialog.querySelectorAll('tr, [role="row"]')];
    for (const row of rows) {
      const cells = row.querySelectorAll('td, [role="cell"]');
      const nameCell = [...cells].find(c => c.textContent?.trim().toLowerCase() === 'birds');
      if (!nameCell) continue;
      const matCb = row.querySelector('mat-checkbox');
      if (matCb) {
        const label = matCb.querySelector('label') || matCb.querySelector('.mdc-checkbox') || matCb;
        label.click();
        return;
      }
      row.click();
      return;
    }
  });
  await page.waitForTimeout(500);

  // Click insert
  await page.getByRole('button', { name: /insert/i }).click({ force: true });
  await page.waitForTimeout(1000);

  // ─── Change "birds" entry duration to 5 ──────────────────────
  const spinsBefore = await page.getByRole('spinbutton').count();

  // Click the edit pencil icon (mat-icon "edit") in the birds row's duration cell
  const birdsEditClicked = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[role="row"], tr')];
    for (const row of rows) {
      if (row.textContent?.toLowerCase().includes('birds') && !row.closest('[role="dialog"]')) {
        const cells = row.querySelectorAll('td, [role="cell"]');
        const durationCell = cells[1];
        if (!durationCell) return false;
        const editIcon = durationCell.querySelector('mat-icon');
        if (editIcon && editIcon.textContent?.trim() === 'edit') {
          editIcon.click();
          return true;
        }
        return false;
      }
    }
    return false;
  });

  if (birdsEditClicked) {
    await page.waitForTimeout(500);
    const spinsAfter = await page.getByRole('spinbutton').count();
    if (spinsAfter > spinsBefore) {
      const spin = page.getByRole('spinbutton').nth(spinsAfter - 1);
      await spin.fill(String(BIRDS_DURATION));
      await spin.press('Enter');
      await page.waitForTimeout(200);
    }
  }

  // ─── Save ─────────────────────────────────────────────────────
  await page.locator('.center-items > button:nth-child(3)').click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 5000 });
});
