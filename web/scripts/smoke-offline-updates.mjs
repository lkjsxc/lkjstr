// These use the actual generated worker, real browser lifecycle, and no external network.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { shellFixture, waitFor } from './offline-fixture.mjs';
import { shellWorker } from './shell-cache.ts';

export async function shellUpdates(generate = shellWorker) {
  const failures = [];
  for (const [label, scenario] of [
    [
      'rollback',
      async (f) => {
        assert.equal(await f.update('b'), 'installed');
        const viable = await f.page.evaluate(() => caches.keys());
        assert.equal(viable.length, 2);
        assert.equal(await f.update('c', true), 'redundant');
        assert.deepEqual(
          await f.page.evaluate(() => caches.keys()),
          viable,
          'failed install preserves active and waiting shells',
        );
        await f.update('a', true);
        const cached = await f.page.evaluate(
          async (cacheName) => (await caches.match('/index.html', { cacheName }))?.text(),
          f.first[0],
        );
        assert.equal(
          cached,
          f.versions.get('a').files.get('/index.html'),
          'failed rollback cannot delete the cache of the active build',
        );
        await f.context.setOffline(true);
        assert.equal(
          await f.page.evaluate(async () => (await fetch('/shell-a.js')).text()),
          f.versions.get('a').files.get('/shell-a.js'),
        );
      },
    ],
    [
      'waiting retention',
      async (f) => {
        for (const id of ['b', 'c', 'd', 'e']) {
          assert.equal(await f.update(id), 'installed');
          const names = await f.page.evaluate(() => caches.keys());
          assert.ok(names.includes(f.first[0]), 'active shell survives every waiting replacement');
          assert.ok(names.length <= 3, `waiting replacements must stay bounded: ${names.length}`);
          assert.equal(
            await f.page.evaluate(async () => (await fetch('/index.html')).text()),
            f.versions.get('a').files.get('/index.html'),
            'old tab stays on its complete build',
          );
        }
        // This same-origin observer is outside the registration scope, so it cannot keep A alive.
        const observer = await f.context.newPage();
        await observer.goto(`${f.origin}/observer`);
        await f.page.close();
        await waitFor(observer, async () => {
          const r = await navigator.serviceWorker.getRegistration('/app/');
          return r.active?.state === 'activated' && !r.waiting && !r.installing;
        });
        assert.equal(
          (await observer.evaluate(() => caches.keys())).length,
          1,
          'completed activation releases retired shells without a new client',
        );
        const fresh = await f.context.newPage();
        await fresh.goto(`${f.origin}/app/fixture`);
        await waitFor(fresh, () => !!navigator.serviceWorker.controller);
        await waitFor(fresh, async () => (await caches.keys()).length === 1);
        const names = await fresh.evaluate(() => caches.keys());
        assert.equal(names.length, 1, 'activation or first fetch releases all retired shells');
        assert.notEqual(names[0], f.first[0]);
        await f.context.setOffline(true);
        assert.equal(
          await fresh.evaluate(async () => (await fetch('/shell-e.js')).text()),
          f.versions.get('e').files.get('/shell-e.js'),
        );
      },
    ],
  ]) {
    try {
      await shellFixture(generate, scenario);
      console.log(`ok offline ${label}`);
    } catch (error) {
      failures.push(error);
      console.error(`failed offline ${label}: ${error.message}`);
    }
  }
  if (failures.length) throw new AggregateError(failures, 'shell update regressions');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await shellUpdates();
