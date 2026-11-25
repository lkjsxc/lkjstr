import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import { join } from 'node:path';
import { transform } from 'esbuild';
import { AVATAR_CACHE, AVATAR_FRAGMENT } from '../src/engine/avatar-cache.ts';
import { shellFixture, waitFor } from './offline-fixture.mjs';
import { shellWorker } from './shell-cache.ts';

async function avatarOrigins(bytes, run) {
  const directory = await mkdtemp(new URL('../../tmp/avatar-test-', import.meta.url).pathname);
  const key = join(directory, 'key.pem');
  const cert = join(directory, 'cert.pem');
  const servers = [];
  const requests = [];
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-keyout',
        key,
        '-out',
        cert,
      ],
      { stdio: 'ignore' },
    );
    const tls = { key: await readFile(key), cert: await readFile(cert) };
    for (const cors of [true, false]) {
      const server = createServer(tls, (req, res) => {
        const path = new URL(req.url, 'https://fixture').pathname;
        requests.push({ path, headers: req.headers });
        const body = path === '/large.png' ? Buffer.concat([bytes, Buffer.alloc(131072)]) : bytes;
        const cache = new Map([
          ['/private.png', 'private'],
          ['/no-store.png', 'no-store'],
        ]);
        res
          .writeHead(200, {
            'content-type': 'image/png',
            'content-length': body.length,
            'cache-control': [cache.get(path), 'max-age=120'].filter(Boolean).join(', '),
            vary: 'Sec-Fetch-Mode',
            ...(cors ? { 'access-control-allow-origin': '*' } : {}),
          })
          .end(body);
      });
      servers.push(server);
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
    }
    const origins = servers.map((s) => `https://127.0.0.1:${s.address().port}`);
    await run({ cdn: origins[0], opaque: origins[1], requests });
  } finally {
    await Promise.all(
      servers.map((server) => {
        server.closeAllConnections();
        return new Promise((done) => server.close(done));
      }),
    );
    await rm(directory, { recursive: true, force: true });
  }
}

export async function avatarCacheChecks() {
  const bytes = await readFile(new URL('../../static/icon-192.png', import.meta.url));
  const source = await readFile(new URL('../src/engine/avatar-cache.ts', import.meta.url), 'utf8');
  const { code } = await transform(source, { loader: 'ts' });
  await avatarOrigins(bytes, async ({ cdn, opaque, requests }) => {
    await shellFixture(
      shellWorker,
      async ({ page, context, origin }) => {
        await context.route(`${origin}/avatar-fixture.js`, (route) =>
          route.fulfill({ contentType: 'text/javascript', body: code }),
        );

        const paint = (url, usingLoader = true) =>
          page.evaluate(
            async ({ url, usingLoader }) => {
              const loader = usingLoader ? await import('/avatar-fixture.js') : null;
              const img = document.createElement('img');
              img.referrerPolicy = 'no-referrer';
              document.body.append(img);
              return new Promise((resolve) => {
                img.onload = () => resolve(img.naturalWidth > 0);
                img.onerror = () => resolve(false);
                if (loader) loader.loadPublicAvatar(img, url);
                else img.src = url;
              });
            },
            { url, usingLoader },
          );
        const keys = () =>
          page.evaluate(
            async (name) => (await (await caches.open(name)).keys()).map((key) => key.url),
            AVATAR_CACHE,
          );
        const waitForCopy = (url) =>
          waitFor(page, ({ name, url }) => caches.match(url, { cacheName: name }), {
            name: AVATAR_CACHE,
            url,
          });

        for (const url of [
          `${opaque}/picture.png`,
          `${cdn}/private.png`,
          `${cdn}/no-store.png`,
          `${cdn}/large.png`,
          `${cdn}/query.png?local=1`,
          `${cdn}/media.png`,
        ]) {
          assert.ok(await paint(url, !url.endsWith('/media.png')));
        }
        const publicUrl = `${cdn}/public.png`;
        assert.ok(await paint(publicUrl));
        await waitForCopy(publicUrl);
        assert.deepEqual(await keys(), [publicUrl]);
        assert.ok(
          requests.some(
            (r) =>
              r.path === '/public.png' &&
              r.headers['sec-fetch-mode'] === 'cors' &&
              !r.headers.cookie &&
              !r.headers.referer,
          ),
        );

        await page.evaluate(
          async ({ name, cdn }) => {
            const cache = await caches.open(name);
            const bytes = await (await cache.match(`${cdn}/public.png`)).blob();
            for (let i = 0; i < 63; i++) {
              await cache.put(
                `${cdn}/seed-${i}.png`,
                new Response(bytes, {
                  headers: {
                    'content-type': 'image/png',
                    'x-lkjstr-avatar-expires': String(Date.now() + 120000),
                  },
                }),
              );
            }
          },
          { name: AVATAR_CACHE, cdn },
        );
        const survivor = `${cdn}/recent.png`;
        assert.ok(await paint(survivor));
        await waitForCopy(survivor);
        assert.equal((await keys()).length, 64);
        assert.ok(!(await keys()).includes(publicUrl));

        await page.reload();
        const before = requests.length;
        await context.setOffline(true);
        assert.ok(await paint(survivor + AVATAR_FRAGMENT, false));
        assert.equal(requests.length, before);
        await context.setOffline(false);
        await page.evaluate(
          async ({ name, survivor }) => {
            await (await caches.open(name)).put(survivor, new Response(null));
          },
          { name: AVATAR_CACHE, survivor },
        );
        await page.reload();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.clearBrowserCache');
        assert.ok(await paint(survivor + AVATAR_FRAGMENT, false));
        assert.ok(requests.length > before, 'an expired copy goes to the native image path');
      },
      { fixtureTls: true },
    );
  });
  console.log('ok avatar cache (public CORS copies, native fallback, expiry and bound)');
}
