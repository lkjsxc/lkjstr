// Isolated in-memory origin; every page, browser and listener is reaped on failure.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { shellBrowser } from './offline-browser.mjs';

// Playwright 1.65 treats an async waitForFunction predicate's Promise as truthy.
export async function waitFor(page, predicate, arg, timeout = 30000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(predicate, arg)) return;
    if (Date.now() >= end) throw new Error('offline fixture condition timeout');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export async function shellFixture(generate, run) {
  const versions = new Map();
  for (const id of ['a', 'b', 'c', 'd', 'e']) {
    const files = new Map([
      ['/index.html', `<!doctype html><title>Shell ${id}</title>`],
      [`/shell-${id}.js`, `/* immutable shell ${id} */`],
    ]);
    const manifest = [...files].map(([path, body]) => [
      path,
      createHash('sha256').update(body).digest('hex'),
    ]);
    versions.set(id, { files, source: generate(manifest) });
  }
  let serving = 'a';
  let corrupt = false;
  let held = null;
  const requests = [];
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://fixture').pathname;
    requests.push({ path, serving, corrupt });
    res.setHeader('cache-control', 'no-store');
    if (path === '/sw.js')
      return res
        .writeHead(200, { 'content-type': 'text/javascript' })
        .end(versions.get(serving).source);
    if (['/app/fixture', '/observer'].includes(path))
      return res
        .writeHead(200, { 'content-type': 'text/html' })
        .end('<!doctype html><title>Shell lifecycle fixture</title>');
    const body = versions.get(serving).files.get(path);
    if (held && held.id === serving && path === `/shell-${serving}.js`) {
      held.observed();
      held.respond = () => res.writeHead(200, { 'content-type': 'text/javascript' }).end(body);
      return;
    }
    if (body === undefined) return res.writeHead(404).end();
    res
      .writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : 'text/html' })
      .end(corrupt && path.endsWith('.js') ? 'changed bytes' : body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await shellBrowser();
    const context = await browser.newContext();
    if (process.env.LKJSTR_SHELL_DEBUG)
      context.on('console', (message) => console.error(message.text()));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await context.newPage();
    await page.goto(`${origin}/app/fixture`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js', { scope: '/app/', updateViaCache: 'none' });
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('fixture install timeout')), 15000),
        ),
      ]);
    });
    await page.reload();
    await waitFor(page, () => navigator.serviceWorker.controller?.state === 'activated');
    const first = await page.evaluate(() => caches.keys());
    assert.equal(first.length, 1);
    await run({
      page,
      context,
      origin,
      first,
      versions,
      requests,
      serve(id, broken = false) {
        serving = id;
        corrupt = broken;
      },
      hold(id) {
        let observed;
        const requested = new Promise((resolve) => {
          observed = resolve;
        });
        held = { id, observed, respond: null };
        return {
          requested,
          release() {
            const gate = held;
            held = null;
            gate.respond();
          },
        };
      },
      async update(id, broken = false, from = page) {
        serving = id;
        corrupt = broken;
        return from.evaluate(async () => {
          const r = await navigator.serviceWorker.getRegistration('/app/');
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('fixture update timeout')), 15000);
            r.addEventListener(
              'updatefound',
              () => {
                const worker = r.installing;
                const changed = () => {
                  if (!['installed', 'activated', 'redundant'].includes(worker.state)) return;
                  clearTimeout(timer);
                  worker.removeEventListener('statechange', changed);
                  resolve(worker.state);
                };
                worker.addEventListener('statechange', changed);
                changed();
              },
              { once: true },
            );
            r.update().catch((error) => {
              clearTimeout(timer);
              reject(error);
            });
          });
        });
      },
    });
  } finally {
    try {
      await browser?.close();
    } finally {
      await new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      });
    }
  }
}
