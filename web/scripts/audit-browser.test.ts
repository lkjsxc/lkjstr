import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import { chromium } from 'playwright-core';
import { auditCsp, historicalCacheHit, rebaseStorageState } from './audit-browser.ts';

async function listen(server: Server): Promise<string> {
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
const close = (server: Server) => new Promise<void>((done) => server.close(() => done()));

test('rebases returning storage across fresh ports and proves cache reuse with off-origin isolation', {
  timeout: 20000,
}, async () => {
  let assets = 0;
  let outside = 0;
  const server = createServer((req, res) => {
    const asset = req.url === '/historical.js';
    if (asset) assets++;
    res.writeHead(200, {
      'Content-Type': asset ? 'text/javascript' : 'text/html',
      'Cache-Control': asset ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Security-Policy': auditCsp(),
    });
    res.end(asset ? 'window.historical = true;' : '<script src="/historical.js"></script>');
  });
  const other = createServer((_, res) => {
    outside++;
    res.end('outside');
  });
  const base = await listen(server);
  const old = await listen(other);
  const browser = await chromium.launch({
    executablePath:
      process.env.LKJSTR_CHROME ??
      `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
    args: ['--no-sandbox'],
  });
  try {
    const original = await browser.newContext();
    const first = await original.newPage();
    await first.goto(old);
    await first.evaluate(() => {
      localStorage.setItem('lkjstr:settings', '{"textSize":18}');
      localStorage.setItem('lkjstr:layout:main', '{"id":"custom-pane"}');
    });
    const snapshot = await original.storageState();
    const state = rebaseStorageState(snapshot, base);
    assert.equal(snapshot.origins[0]!.origin, old);
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();
    await page.goto(base);
    assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))), {
      'lkjstr:settings': '{"textSize":18}',
      'lkjstr:layout:main': '{"id":"custom-pane"}',
    });
    assert.equal(assets, 1);
    assert.equal(await historicalCacheHit(page), true);
    assert.equal(assets, 1);
    outside = 0;
    assert.equal(
      await page.evaluate(async (url) => {
        try {
          await fetch(url);
          return false;
        } catch {
          return true;
        }
      }, old),
      true,
    );
    assert.equal(outside, 0);
    // Guard the original failure: even pass-through routing must fail the cache-hit check.
    await context.route('**/*', (route) => route.continue());
    assert.equal(await historicalCacheHit(page), false);
    assert.equal(assets, 2);
    await context.close();
    await original.close();
  } finally {
    await browser.close();
    await close(server);
    await close(other);
  }
});
