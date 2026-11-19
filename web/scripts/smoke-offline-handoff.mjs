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
      field.value = sessionStorage.getItem('fixture-draft') ?? '';
      field.addEventListener('input', () => sessionStorage.setItem('fixture-draft', field.value));
      document.documentElement.dataset.ready = '${id}';
      installShell(() => Boolean(field.value), () => {
        document.querySelector('[role="status"]').textContent = 'A new version is ready. Reload to update.';
      });
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
    await first.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await first.close();
    const reload = await context.newPage();
    await reload.goto(origin);
    await waitFor(reload, () => navigator.serviceWorker.controller?.state === 'activated');
    const reading = await context.newPage();
    await reading.goto(origin);
    await waitFor(reading, () => document.documentElement.dataset.ready === 'a');
    serving = 'b';
    await reload.reload();
    await reload.locator('html[data-ready="b"]').waitFor({ state: 'attached' });
    assert.equal(await reading.title(), 'shell a', 'a different open tab keeps its running app');
    assert.equal(
      await reading.evaluate(async (path) => (await fetch(path)).text(), versions.get('a').appPath),
      versions.get('a').app,
      'old hashed assets are still available after handoff',
    );
    await reading.close();
    await reload.bringToFront();
    await reload.locator('textarea').fill('Keep my unsent text');
    serving = 'c';
    await reload.reload();
    await reload
      .getByRole('status')
      .filter({ hasText: 'A new version is ready. Reload to update.' })
      .waitFor();
    assert.equal(await reload.title(), 'shell b', 'an unsent draft prevents an automatic reload');
    assert.equal(await reload.locator('textarea').inputValue(), 'Keep my unsent text');
    await reload.reload();
    await reload.locator('html[data-ready="c"]').waitFor({ state: 'attached' });
    assert.equal(await reload.locator('textarea').inputValue(), 'Keep my unsent text');
    await context.close();
    console.log('ok offline handoff (ordinary reload, old assets, retained draft)');
  } finally {
    await browser?.close();
    await new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    });
  }
}
