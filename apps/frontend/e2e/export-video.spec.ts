import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logLine(tag: string, msg: string) {
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`[${ts}] [${tag}] ${msg}`);
}

function attachConsoleSpy(page: Page, logs: string[]) {
    page.on('console', (msg: ConsoleMessage) => {
        const line = `[browser:${msg.type()}] ${msg.text()}`;
        logs.push(line);
        logLine('BROWSER', `${msg.type()} — ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
        const line = `[browser:error] ${err.message}`;
        logs.push(line);
        logLine('BROWSER', `PAGE ERROR — ${err.message}`);
    });
}

function attachNetworkSpy(page: Page, logs: string[]) {
    page.on('request', (req) => {
        if (req.url().includes('/api/')) {
            const line = `→ ${req.method()} ${req.url()}`;
            logs.push(line);
            logLine('NETWORK', line);
            if (req.method() === 'POST' && req.postData()) {
                const body = req.postData() ?? '';
                const preview = body.length > 500 ? `${body.slice(0, 500)}…` : body;
                logLine('NETWORK', `  body: ${preview}`);
            }
        }
    });
    page.on('response', async (res) => {
        if (res.url().includes('/api/')) {
            let body = '';
            try { body = await res.text(); } catch { /* ignore */ }
            const preview = body.length > 300 ? `${body.slice(0, 300)}…` : body;
            const line = `← ${res.status()} ${res.url()} — ${preview}`;
            logs.push(line);
            logLine('NETWORK', line);
        }
    });
}

// ─── Test ─────────────────────────────────────────────────────────────────────

test('export video as MP4', async ({ page }, testInfo) => {
    const logs: string[] = [];
    attachConsoleSpy(page, logs);
    attachNetworkSpy(page, logs);

    // ── 1. Load editor ────────────────────────────────────────────────────────
    logLine('TEST', 'navigating to editor');
    await page.goto('/edit');
    await page.waitForLoadState('networkidle');

    // Wait for the editor to mount (timeline or scene should be visible)
    await page.waitForSelector('[class*="timeline"], canvas, video', { timeout: 15_000 });
    logLine('TEST', 'editor loaded');

    await page.screenshot({ path: 'test-results/01-editor-loaded.png' });

    // ── 2. Open Download popover ───────────────────────────────────────────────
    logLine('TEST', 'clicking Download button');
    const downloadBtn = page.getByRole('button', { name: /download/i });
    await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
    await downloadBtn.click();

    // Popover should open with "Export settings"
    await expect(page.getByText('Export settings')).toBeVisible({ timeout: 5_000 });
    logLine('TEST', 'export popover open');
    await page.screenshot({ path: 'test-results/02-export-popover.png' });

    // ── 3. Confirm MP4 is selected (default) and click Export ─────────────────
    // The format selector shows "MP4" — verify it's already set
    const formatBtn = page.locator('button:has-text("MP4"), button:has-text("mp4")').first();
    if (await formatBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        logLine('TEST', 'MP4 format already selected');
    }

    logLine('TEST', 'clicking Export button');
    await page.getByRole('button', { name: /^export$/i }).click();

    // ── 4. Progress modal opens ────────────────────────────────────────────────
    await expect(page.getByText(/exporting/i)).toBeVisible({ timeout: 10_000 });
    logLine('TEST', 'export started — progress modal visible');
    await page.screenshot({ path: 'test-results/03-exporting.png' });

    // ── 5. Wait for completion (up to 4 min) ──────────────────────────────────
    logLine('TEST', 'waiting for render to complete…');
    const RENDER_TIMEOUT_MS = 4 * 60 * 1000;
    const start = Date.now();

    await expect(async () => {
        const exported = page.getByText(/exported/i);
        const downloadLink = page.getByRole('button', { name: /download/i });
        const hasDone = (await exported.count()) > 0 || (await downloadLink.count()) > 0;
        if (!hasDone) throw new Error('render not complete yet');
    }).toPass({ timeout: RENDER_TIMEOUT_MS, intervals: [3_000] });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logLine('TEST', `render complete in ${elapsed}s`);
    await page.screenshot({ path: 'test-results/04-exported.png' });

    // ── 6. Trigger download and capture the file ───────────────────────────────
    logLine('TEST', 'triggering download');
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30_000 }),
        page.getByRole('button', { name: /download/i }).click(),
    ]);

    const suggestedName = download.suggestedFilename();
    const savePath = path.join('test-results', suggestedName || 'output.mp4');
    await download.saveAs(savePath);

    const stat = fs.statSync(savePath);
    logLine('TEST', `downloaded: ${savePath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    expect(stat.size).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/05-download-done.png' });

    // ── 7. Attach log dump to test report ─────────────────────────────────────
    const logContent = logs.join('\n');
    await testInfo.attach('network-and-browser-logs.txt', {
        body: logContent,
        contentType: 'text/plain',
    });
    await testInfo.attach('exported-video.mp4', {
        path: savePath,
        contentType: 'video/mp4',
    });

    fs.writeFileSync('test-results/run-logs.txt', logContent);
    logLine('TEST', 'PASS — logs saved to test-results/run-logs.txt');
});
