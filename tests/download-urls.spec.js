// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const DOWNLOADS_URL = 'https://galaxy.signage.me/signstudio/shopping-cart/downloads';
const REPORT_PATH = path.join(process.cwd(), 'download-report.html');

/**
 * All known download URLs from the downloads page, collected by
 * intercepting window.open() calls from Angular click handlers.
 */
const DOWNLOAD_LINKS = [
  {
    name: 'LegacyStudio Desktop (Windows .exe)',
    url: 'https://galaxy.signage.me/code/install/exe/CloudSignageStudioSetup.exe',
  },
  {
    name: 'LegacyStudio Desktop (macOS .pkg)',
    url: 'https://www.digitalsignage.com/downloads/StudioProMacSigned.pkg',
  },
  {
    name: 'Adobe Runtime AIR (Cross-platform)',
    url: 'https://galaxy.signage.me/Code/Install/air/CloudSignageStudio.air',
  },
  {
    name: 'SignagePlayer.exe (Windows)',
    url: 'https://galaxy.signage.me/Code/install/exe/CloudSignagePlayerSetup.exe',
  },
  {
    name: 'SignagePlayer.apk v1 (Android)',
    url: 'https://galaxy.signage.me/Code/Install/apk/6.3/CloudSignagePlayer.apk',
  },
  {
    name: 'Android Watchdog v2',
    url: 'https://www.digitalsignage.com/downloads/app-v2-release_adz_watchdog.apk',
  },
  {
    name: 'Android Watchdog v1',
    url: 'https://www.digitalsignage.com/downloads/app-v1-release_adz_watchdog.apk',
  },
  {
    name: 'SignagePlayer.air (Mac/Windows)',
    url: 'https://galaxy.signage.me/Code/Install/air/CloudSignagePlayer.air',
  },
  {
    name: 'SignagePlayer for Linux',
    url: 'https://galaxy.signage.me/Code/mediaServerSignagePlayer.air',
  },
  {
    name: 'SignPlayer Main Download Page',
    url: 'https://galaxy.signage.me/installplayer/',
  },
  {
    name: 'SignService (Android APK)',
    url: 'https://galaxy.signage.me/deploy/android/signService.apk',
  },
  {
    name: 'SignService (Windows Installer)',
    url: 'https://galaxy.signage.me/deploy/win-x64/SignServiceSetup.exe',
  },
];

/** Collect results across all tests, then write report in teardown */
const report = [];

test.describe('Downloads page – verify download URLs', () => {
  test('page loads and shows both Studio and Player sections', async ({ page }) => {
    await page.goto(DOWNLOADS_URL);

    await expect(page.getByRole('heading', { name: 'SignStudio' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SignPlayer' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Login to SignStudio/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download now/i })).toBeVisible();
  });

  for (const link of DOWNLOAD_LINKS) {
    test(`download URL reachable: ${link.name}`, async ({ request }) => {
      let status = 0;
      let statusText = '';
      let ok = false;
      try {
        const response = await request.head(link.url, {
          maxRedirects: 5,
          timeout: 30000,
        });
        status = response.status();
        statusText = response.statusText();
        ok = response.ok() || [301, 302].includes(status);
      } catch (err) {
        statusText = err.message;
      }

      report.push({
        name: link.name,
        url: link.url,
        status,
        statusText,
        ok,
      });

      expect(
        ok,
        `Expected ${link.url} to return 200 or redirect, got ${status}`
      ).toBeTruthy();
    });
  }

  test('legacy cards trigger correct download URLs via window.open', async ({ page }) => {
    await page.goto(DOWNLOADS_URL);

    // Expand legacy sections
    await page.getByRole('button', { name: /Show Legacy Versions/i }).first().click();
    await page.waitForSelector('.legacy-card', { timeout: 5000 });

    // Intercept window.open
    await page.evaluate(() => {
      window.__capturedUrls = [];
      window.open = function (url) {
        window.__capturedUrls.push(url);
        return null;
      };
    });

    // Click each legacy card and verify a URL was captured
    const legacyCards = page.locator('.legacy-card');
    const count = await legacyCards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await page.evaluate(() => { window.__capturedUrls = []; });
      await legacyCards.nth(i).click();
      const urls = await page.evaluate(() => window.__capturedUrls);
      expect(urls.length, `Legacy card ${i} should trigger a download URL`).toBeGreaterThan(0);
      expect(urls[0]).toMatch(/^https?:\/\//);
    }
  });

  test('SignService Android dialog triggers correct download URL', async ({ page }) => {
    await page.goto(DOWNLOADS_URL);

    // Expand advanced options
    await page.getByRole('button', { name: /Show Advanced Options/i }).click();
    await page.waitForSelector('.service-cards-compact', { timeout: 5000 });

    // Intercept window.open
    await page.evaluate(() => {
      window.__capturedUrls = [];
      window.open = function (url) {
        window.__capturedUrls.push(url);
        return null;
      };
    });

    // Click Android SignService card to open dialog
    const androidCard = page.locator('.service-cards-compact div[class*="card"]', { hasText: 'Android' }).first();
    await androidCard.click();
    await page.waitForSelector('dialog, [role="dialog"]', { timeout: 5000 });

    // Click "Download APK" button inside dialog
    await page.getByRole('button', { name: /Download APK/i }).click();
    const urls = await page.evaluate(() => window.__capturedUrls);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0]).toContain('signService.apk');

    // Close dialog
    await page.locator('dialog button, [role="dialog"] button').filter({ hasText: 'close' }).click();
  });

  test('SignService Windows dialog triggers correct download URL', async ({ page }) => {
    await page.goto(DOWNLOADS_URL);

    // Expand advanced options
    await page.getByRole('button', { name: /Show Advanced Options/i }).click();
    await page.waitForSelector('.service-cards-compact', { timeout: 5000 });

    // Intercept window.open
    await page.evaluate(() => {
      window.__capturedUrls = [];
      window.open = function (url) {
        window.__capturedUrls.push(url);
        return null;
      };
    });

    // Click Windows SignService card to open dialog
    const windowsCard = page.locator('.service-cards-compact div[class*="card"]', { hasText: 'Windows' }).first();
    await windowsCard.click();
    await page.waitForSelector('dialog, [role="dialog"]', { timeout: 5000 });

    // Click "Download for Windows" button inside dialog
    await page.getByRole('button', { name: /Download for Windows/i }).click();
    const urls = await page.evaluate(() => window.__capturedUrls);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0]).toContain('SignServiceSetup.exe');

    // Close dialog
    await page.locator('dialog button, [role="dialog"] button').filter({ hasText: 'close' }).click();
  });

  test('main SignPlayer download button triggers download URL', async ({ page }) => {
    await page.goto(DOWNLOADS_URL);

    await page.evaluate(() => {
      window.__capturedUrls = [];
      window.open = function (url) {
        window.__capturedUrls.push(url);
        return null;
      };
    });

    await page.getByRole('button', { name: /Download now/i }).click();
    const urls = await page.evaluate(() => window.__capturedUrls);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0]).toContain('galaxy.signage.me/installplayer');
  });

  test('generate download URL report', async ({ request }) => {
    // Re-check any URLs not yet in the report (in case earlier tests were skipped)
    const checked = new Set(report.map(r => r.url));
    for (const link of DOWNLOAD_LINKS) {
      if (checked.has(link.url)) continue;
      let status = 0;
      let statusText = '';
      let ok = false;
      try {
        const response = await request.head(link.url, {
          maxRedirects: 5,
          timeout: 30000,
        });
        status = response.status();
        statusText = response.statusText();
        ok = response.ok() || [301, 302].includes(status);
      } catch (err) {
        statusText = err.message;
      }
      report.push({ name: link.name, url: link.url, status, statusText, ok });
    }

    // Build report
    const timestamp = new Date().toLocaleString();
    const goodCount = report.filter(r => r.ok).length;
    const brokenCount = report.filter(r => !r.ok).length;

    const rows = report.map((r, i) => `
            <tr class="${r.ok ? 'good' : 'broken'}">
              <td>${i + 1}</td>
              <td><span class="badge ${r.ok ? 'badge-good' : 'badge-broken'}">${r.ok ? 'GOOD' : 'BROKEN'}</span></td>
              <td>${r.name}</td>
              <td><a href="${r.url}" target="_blank">${r.url}</a></td>
              <td>${r.status} ${r.statusText}</td>
            </tr>`).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download URL Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #1a1a2e; padding: 32px; }
    .container { max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    .meta a { color: #4361ee; text-decoration: none; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; }
    .summary-card { background: #fff; border-radius: 10px; padding: 20px 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); flex: 1; text-align: center; }
    .summary-card .number { font-size: 36px; font-weight: 700; }
    .summary-card .label { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .summary-card.total .number { color: #4361ee; }
    .summary-card.good .number { color: #2dc653; }
    .summary-card.broken .number { color: #e63946; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    th { background: #4361ee; color: #fff; text-align: left; padding: 14px 16px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 12px 16px; border-bottom: 1px solid #eee; font-size: 14px; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr.broken { background: #fff5f5; }
    td a { color: #4361ee; text-decoration: none; word-break: break-all; }
    td a:hover { text-decoration: underline; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-good { background: #d4edda; color: #155724; }
    .badge-broken { background: #f8d7da; color: #721c24; }
    .broken-section { margin-top: 24px; background: #fff5f5; border: 1px solid #f5c6cb; border-radius: 10px; padding: 20px; }
    .broken-section h3 { color: #e63946; margin-bottom: 12px; }
    .broken-section li { margin-bottom: 6px; font-size: 14px; }
    .broken-section a { color: #e63946; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Download URL Report</h1>
    <p class="meta">Generated: ${timestamp} &mdash; Page: <a href="${DOWNLOADS_URL}" target="_blank">${DOWNLOADS_URL}</a></p>

    <div class="summary">
      <div class="summary-card total"><div class="number">${report.length}</div><div class="label">URLs Checked</div></div>
      <div class="summary-card good"><div class="number">${goodCount}</div><div class="label">Good</div></div>
      <div class="summary-card broken"><div class="number">${brokenCount}</div><div class="label">Broken</div></div>
    </div>

    <table>
      <thead>
        <tr><th>#</th><th>Status</th><th>Name</th><th>URL</th><th>HTTP</th></tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
${brokenCount > 0 ? `
    <div class="broken-section">
      <h3>Broken Links</h3>
      <ul>
        ${report.filter(r => !r.ok).map(r => `<li><strong>${r.name}</strong> &mdash; <a href="${r.url}">${r.url}</a> (HTTP ${r.status})</li>`).join('\n        ')}
      </ul>
    </div>
` : ''}
  </div>
</body>
</html>`;

    // Write HTML report and print summary to console
    fs.writeFileSync(REPORT_PATH, html, 'utf-8');

    console.log(`\n${'='.repeat(70)}`);
    console.log(`  DOWNLOAD URL REPORT — ${report.length} checked | ${goodCount} GOOD | ${brokenCount} BROKEN`);
    console.log(`${'='.repeat(70)}`);
    report.forEach((r, i) => {
      console.log(`  ${String(i + 1).padStart(2)}.  [${r.ok ? 'GOOD  ' : 'BROKEN'}]  ${r.name}`);
    });
    console.log(`${'='.repeat(70)}`);
    console.log(`  Report saved to: ${REPORT_PATH}`);
  });
});
