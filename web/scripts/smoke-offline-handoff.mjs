import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { transform } from 'esbuild';
import { shellBrowser } from './offline-browser.mjs';
import { waitFor } from './offline-fixture.mjs';
import { shellWorker } from './shell-cache.ts';

const hash = (body) => createHash('sha256').update(body).digest('hex');

export async function shellHandoff() {
  const client = await readFile(new URL('../src/engine/offline-shell.ts', import.meta.url), 'utf8');
  const versions = new Map();
  for (const id of ['a', 'b', 'c']) {
    const { code: app } = await transform(
      `
      ${client}
      const field = document.querySelector('textarea');
      const update = ServiceWorkerRegistration.prototype.update;
      window.fixtureChecks = 0;
      ServiceWorkerRegistration.prototype.update = function () {
        window.fixtureChecks++;
        return update.call(this);
      };
      window.fixtureVisible = true;
      Object.defineProperty(document, 'visibilityState', {
        get: () => window.fixtureVisible ? 'visible' : 'hidden',
      });
      sessionStorage.setItem('fixture-loads', Number(sessionStorage.getItem('fixture-loads')) + 1);
      field.value = sessionStorage.getItem('fixture-draft') ?? '';
      field.addEventListener('input', () => sessionStorage.setItem('fixture-draft', field.value));
      document.documentElement.dataset.ready = '${id}';
      installShell(() => Boolean(field.value), () => {
        document.querySelector('[role="status"]').textContent = 'A new version is ready. Reload to update.';
      }, { get: () => true, subscribe: () => () => {} });
    `,
      { loader: 'ts', format: 'esm' },
    );
    const appPath = `/app-${hash(app).slice(0, 16)}.js`;
    const index = `<!doctype html><title>shell ${id}</title><textarea></textarea>
      <div role="status"></div><script type="module" src="${appPath}"></script>`;
    const files = new Map([
      [appPath, app],
      ['/index.html', index],
    ]);
    const worker = shellWorker([...files].map(([path, content]) => [path, hash(content)]));
    versions.set(id, { appPath, app, index, worker });
  }
  let serving = 'a';
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://local');
    const version = versions.get(serving);
    res.setHeader('cache-control', 'no-store');
    if (pathname === '/sw.js' || pathname === version.appPath)
      return res
        .writeHead(200, { 'content-type': 'text/javascript' })
        .end(pathname === '/sw.js' ? version.worker : version.app);
    if (pathname === '/' || pathname === '/index.html')
      return res.writeHead(200, { 'content-type': 'text/html' }).end(version.index);
    return res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await shellBrowser();
    const context = await browser.newContext();
    const first = await context.newPage();
    await first.goto(origin);
    await waitFor(first, () => navigator.serviceWorker.ready.then(() => true));
    await waitFor(first, () => window.fixtureChecks === 1);
    await first.locator('textarea').fill('Keep my unsent text');
    const reading = await context.newPage();
    await reading.clock.install();
    await reading.goto(origin);
    await waitFor(reading, () => window.fixtureChecks === 1);
    await reading.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.fixtureVisible = false;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await reading.clock.fastForward(60_000);
    assert.equal(
      await reading.evaluate(() => window.fixtureChecks),
      1,
      'rapid visibility and focus events are throttled and hidden tabs skip checks',
    );
    serving = 'b';
    await reading.evaluate(() => {
      window.fixtureVisible = true;
      document.dispatchEvent(new Event('visibilitychange'));
      window.fixtureVisible = false;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(reading, () => window.fixtureChecks === 2);
    await first.getByRole('status').filter({ hasText: 'A new version is ready.' }).waitFor();
    assert.equal(await reading.title(), 'shell a', 'a hidden client keeps its running document');
    assert.equal(await first.title(), 'shell a', 'a draft keeps its running document');
    assert.equal(await first.locator('textarea').inputValue(), 'Keep my unsent text');
    assert.equal(
      await first.evaluate(async (path) => (await fetch(path)).text(), versions.get('a').appPath),
      versions.get('a').app,
      'old hashed assets are still available after handoff',
    );
    await reading.evaluate(() => {
      window.fixtureVisible = true;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await reading.locator('html[data-ready="b"]').waitFor({ state: 'attached' });
    assert.equal(await reading.evaluate(() => sessionStorage.getItem('fixture-loads')), '2');
    await waitFor(reading, () => window.fixtureChecks === 1);
    await first.locator('textarea').clear();
    await first.locator('textarea').blur();
    await first.locator('html[data-ready="b"]').waitFor({ state: 'attached' });
    assert.equal(await first.evaluate(() => sessionStorage.getItem('fixture-loads')), '2');
    await first.close();
    serving = 'c';
    await reading.clock.fastForward(5 * 60_000);
    await reading.locator('html[data-ready="c"]').waitFor({ state: 'attached' });
    assert.equal(await reading.evaluate(() => sessionStorage.getItem('fixture-loads')), '3');
    await context.close();
    console.log('ok offline handoff (boot, throttled visibility, periodic update, retained draft)');
  } finally {
    await browser?.close();
    await new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    });
  }
}
