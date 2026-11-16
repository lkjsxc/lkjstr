// Faults at update boundaries; all storage and HTTP effects stay in fresh loopback fixtures.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { shellFixture, waitFor } from './offline-fixture.mjs';
import { shellWorker } from './shell-cache.ts';

export async function shellRaces(generate = shellWorker) {
  await shellFixture(generate, async (f) => {
    const orphan = `${f.first[0]}-abandoned`;
    await f.page.evaluate(async (name) => {
      await (await caches.open(name)).put('/index.html', new Response('incomplete'));
    }, orphan);
    assert.equal(await f.update('b'), 'installed');
    const names = await f.page.evaluate(() => caches.keys());
    assert.equal(names.length, 2);
    assert.ok(!names.includes(orphan), 'incomplete same-build orphan is released');
  });
  console.log('ok offline abandoned stage');

  await shellFixture(generate, async (f) => {
    await f.page.evaluate(async (name) => {
      await (await caches.open(name)).delete('/shell-a.js');
    }, f.first[0]);
    f.serve('a', true);
    const accepted = await f.page.evaluate(async () => {
      try {
        await fetch('/shell-a.js');
        return true;
      } catch {
        return false;
      }
    });
    assert.equal(accepted, false, 'a cache miss cannot serve bytes outside the manifest');
    f.serve('a');
    assert.equal(
      await f.page.evaluate(async () => (await fetch('/shell-a.js')).text()),
      f.versions.get('a').files.get('/shell-a.js'),
    );
    assert.deepEqual(
      await f.page.evaluate(() => caches.keys()),
      f.first,
      'network fallback never recreates or adds a cache',
    );
  });
  console.log('ok offline fallback integrity');

  await shellFixture(generate, async (f) => {
    assert.equal(await f.update('b'), 'installed');
    const observer = await f.context.newPage();
    await observer.goto(`${f.origin}/observer`);
    const gate = f.hold('c');
    const pending = f.update('c', false, observer);
    void pending.catch(() => {});
    await Promise.race([
      gate.requested,
      pending.then(() => {
        throw new Error('stage was not held');
      }),
    ]);
    await f.page.close();
    await waitFor(observer, async () => {
      const r = await navigator.serviceWorker.getRegistration('/app/');
      return r.active?.state === 'activated' && !r.waiting && !!r.installing;
    });
    // B can activate and serve while C is blocked in HTTP; its cleanup must retain C's stage.
    const b = await f.context.newPage();
    await b.goto(`${f.origin}/app/fixture`);
    await waitFor(b, async () => (await caches.keys()).length === 2);
    assert.equal(
      await b.evaluate(async () => (await fetch('/index.html')).text()),
      f.versions.get('b').files.get('/index.html'),
    );
    const staged = await b.evaluate(async () =>
      Promise.all(
        (await caches.keys()).map(async (name) =>
          Boolean(await caches.match('/.lkjstr-shell-complete', { cacheName: name })),
        ),
      ),
    );
    assert.deepEqual(staged.sort(), [false, true], 'in-flight C remains incomplete beside B');
    gate.release();
    assert.equal(await pending, 'installed');
    assert.equal(
      await b.evaluate(async () => (await fetch('/index.html')).text()),
      f.versions.get('b').files.get('/index.html'),
      'C cannot take over an open B tab',
    );
    await b.close();
    await waitFor(observer, async () => {
      const r = await navigator.serviceWorker.getRegistration('/app/');
      return r.active?.state === 'activated' && !r.waiting && !r.installing;
    });
    const c = await f.context.newPage();
    await c.goto(`${f.origin}/app/fixture`);
    await waitFor(c, async () => (await caches.keys()).length === 1);
    await f.context.setOffline(true);
    assert.equal(
      await c.evaluate(async () => (await fetch('/shell-c.js')).text()),
      f.versions.get('c').files.get('/shell-c.js'),
    );
  });
  console.log('ok offline activation during install');

  // Inject an interrupted activate task; first-fetch recovery is tested independently of timing.
  const interrupted = (assets) =>
    generate(assets).replace(
      'event.waitUntil(maintain(self.registration.active));',
      '// fixture: interrupted activation',
    );
  await shellFixture(interrupted, async (f) => {
    assert.equal(await f.update('b'), 'installed');
    const observer = await f.context.newPage();
    await observer.goto(`${f.origin}/observer`);
    await f.page.close();
    await waitFor(observer, async () => {
      const r = await navigator.serviceWorker.getRegistration('/app/');
      return r.active?.state === 'activated' && !r.waiting && !r.installing;
    });
    assert.equal(
      (await observer.evaluate(() => caches.keys())).length,
      2,
      'fault injection leaves retired storage for recovery',
    );
    const fresh = await f.context.newPage();
    await fresh.goto(`${f.origin}/app/fixture`);
    await waitFor(fresh, async () => (await caches.keys()).length === 1);
    await f.context.setOffline(true);
    assert.equal(
      await fresh.evaluate(async () => (await fetch('/shell-b.js')).text()),
      f.versions.get('b').files.get('/shell-b.js'),
    );
  });
  console.log('ok offline interrupted activation recovery');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await shellRaces();
