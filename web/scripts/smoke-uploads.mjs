// Both media protocols, all account signers, real cross-origin preflights and UI retry.
import { smokePath } from './smoke-output.ts';
import { openKeyField } from './smoke-seed.mjs';
import { serverMarkScenarios } from './smoke-server-marks.mjs';
import { accounts, compose, launch, setup } from './smoke-signer-support.mjs';
export async function uploadScenarios(options) {
  const { check, bunker } = options;
  const results = await Promise.allSettled(
    ['local', 'extension', 'remote'].map(async (signer) => {
      const media = options.media.bySigner[signer];
      let page = await setup({
        ...options,
        mode: 'upload',
        mediaOrigins: Object.values(media.origins),
      });
      check(`parallel ${signer} startup renders a real Global note`);
      let phase = 'account setup';
      try {
        await page.locator('.acct.out').click();
        if (signer === 'local') await page.locator(`${accounts} [data-f="create"]`).click();
        if (signer === 'extension') await page.locator(`${accounts} [data-f="extension"]`).click();
        if (signer === 'remote') {
          await openKeyField(page);
          await page
            .locator(`${accounts} input`)
            .fill(
              `bunker://${bunker.pubkey}?relay=${encodeURIComponent(`${options.relayUrl}/bunker`)}`,
            );
          await page.locator(`${accounts} input`).press('Enter');
        }
        await page.locator('.acct:not(.out)').waitFor();
        await launch(page, 'Settings', 'settings');
        const defaults = page.locator('[data-entry="set.servers"] .slist .srow');
        await defaults.first().waitFor();
        check(
          `upload ${signer} untested defaults show muted protocols`,
          (await defaults.allTextContents()).every((text) => /Blossom|NIP-96/.test(text)) &&
            (await defaults.locator('.bad').count()) === 0,
        );
        if (process.env.LKJSTR_SHOTS === '1')
          await page
            .locator('[data-entry="set.servers"]')
            .screenshot({ path: smokePath(`screens/upload-defaults-${signer}-en.png`) });
        await launch(page, 'Post', 'compose');
        const text = 'keep upload draft';
        await page.locator(`${compose} textarea`).fill(text);
        const file = {
          name: 'fixture.png',
          mimeType: 'image/png',
          buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMw6lj1HwAEuAJku8vlhQAAAABJRU5ErkJggg==',
            'base64',
          ),
        };
        if (signer === 'extension') {
          page = await serverMarkScenarios({ ...options, page, media, file });
          await page.locator(`${compose} textarea`).fill(text);
        }
        for (const protocol of ['blossom', 'nip96']) {
          const origin = media.origins[protocol];
          const alternate = media.origins[protocol === 'blossom' ? 'nip96' : 'blossom'];
          await page.evaluate((origin) => {
            window.uploadTarget = origin;
          }, origin);
          // Settings saves this same list action. The transport is observed only in test setup.
          await page.evaluate(
            ({ origin, alternate }) => {
              const req = `media-list-${Date.now()}`;
              window.uploadListDone = false;
              window.uploadListResult = undefined;
              window.uploadListReq = req;
              window.uploadPort.postMessage({
                t: 'act',
                req,
                action: {
                  a: 'servers.save',
                  as: window.uploadAccount,
                  servers: [origin, alternate],
                },
              });
            },
            { origin, alternate },
          );
          await page.waitForFunction(() => window.uploadListResult);
          const saved = await page.evaluate(() => window.uploadListResult);
          if (!saved.ok) throw new Error(`media list save failed: ${JSON.stringify(saved)}`);
          await page.waitForTimeout(150);
          for (const mode of [
            'slow',
            'refuse',
            'cors',
            'malformed',
            ...(options.quick ? [] : ['hang', 'body-hang']),
            ...(protocol === 'nip96' ? ['processing'] : []),
          ]) {
            phase = `${protocol} ${mode}`;
            media.set(protocol, mode);
            const start = media.requests.length;
            await page.locator(`${compose} input[type=file]`).setInputFiles(file);
            const thumb = page.locator(`${compose} .thumb`).last();
            const done = thumb.and(page.locator('.thumb.done'));
            await thumb.locator('[role=status]').waitFor();
            if (['slow', 'processing'].includes(mode)) {
              // The picture shows from the moment it is chosen; done is the upload's own mark.
              await thumb.locator('.tpic img').waitFor();
              await done.waitFor({ timeout: 45000 });
              check(
                `upload ${signer} ${protocol} ${mode} shows the destination`,
                (await thumb.innerText()).includes(origin.replace('https://', '')),
              );
              check(
                `upload ${signer} ${protocol} ${mode} completes`,
                await thumb.evaluate((e) => e.classList.contains('done')),
              );
            } else {
              await page.locator(`${compose} .thumb.failed`).last().waitFor({ timeout: 45000 });
              const failure = await thumb.innerText();
              if (process.env.LKJSTR_SHOTS === '1' && mode === 'refuse')
                await page.locator(compose).screenshot({
                  path: smokePath(`screens/upload-failed-${signer}-${protocol}-en.png`),
                });
              check(
                `upload ${signer} ${protocol} ${mode} names server and reason`,
                failure.includes(origin.replace('https://', '')) &&
                  failure.length > 60 &&
                  !failure.includes('internal'),
              );
              check(
                `upload ${signer} ${protocol} ${mode} preserves draft and file`,
                (await page.locator(`${compose} textarea`).inputValue()) === text &&
                  (await thumb.innerText()).includes(file.name),
              );
              await thumb
                .getByRole('combobox', { name: 'Media server' })
                .selectOption(mode === 'refuse' ? alternate : origin);
              media.set(protocol, 'ok');
              media.set(protocol === 'blossom' ? 'nip96' : 'blossom', 'ok');
              phase += ' retry';
              await thumb.getByRole('button', { name: 'Retry', exact: true }).click();
              await done.waitFor({ timeout: 45000 });
              check(`upload ${signer} ${protocol} ${mode} retry completes`);
            }
            const requests = media.requests.slice(start);
            check(
              `upload ${signer} ${protocol} ${mode} auth and preflight`,
              requests.some((r) => r.method === 'OPTIONS') &&
                requests.some((r) => r.valid === true) &&
                requests.every((r) => r.valid !== false),
            );
            await thumb.locator('button.x').click();
          }
        }
        if (signer === 'extension') {
          for (const mode of options.quick ? ['refuse', 'wrong'] : ['refuse', 'wrong', 'hang']) {
            await page.evaluate((mode) => {
              window.uploadSignMode = mode;
            }, mode);
            const start = media.requests.length;
            await page.locator(`${compose} input[type=file]`).setInputFiles(file);
            await page.locator(`${compose} .thumb.failed`).waitFor({ timeout: 75000 });
            check(
              `upload extension ${mode} is visible`,
              (await page.locator(`${compose} .thumb.failed`).innerText()).includes('sign'),
            );
            check(
              `upload extension ${mode} sends no HTTP upload`,
              media.requests.slice(start).every((r) => !['POST', 'PUT'].includes(r.method)),
            );
            await page.evaluate(() => {
              window.uploadSignMode = 'ok';
            });
            await page.locator(compose).getByRole('button', { name: 'Retry', exact: true }).click();
            await page.locator(`${compose} .thumb.done`).waitFor();
            check(`upload extension ${mode} retries the retained file`);
            await page.locator(`${compose} .thumb button.x`).click();
          }
        }
        if (signer === 'remote') {
          for (const mode of ['refuse', 'outage']) {
            bunker.refuse(mode === 'refuse');
            bunker.hold(mode === 'outage');
            await page.locator(`${compose} input[type=file]`).setInputFiles(file);
            if (mode === 'outage') {
              for (let n = 0; n < 100 && !bunker.waiting(); n++) await page.waitForTimeout(25);
              check('upload remote signing round trip starts', bunker.waiting() > 0);
              bunker.down();
              bunker.hold(false);
            }
            await page.locator(`${compose} .thumb.failed`).waitFor();
            check(`upload remote ${mode} is visible`);
            bunker.up();
            bunker.refuse(false);
            bunker.hold(false);
            await page.locator(compose).getByRole('button', { name: 'Retry', exact: true }).click();
            await page.locator(`${compose} .thumb.done`).waitFor();
            check(`upload remote ${mode} retries the retained file`);
            await page.locator(`${compose} .thumb button.x`).click();
          }
        }
        if (signer === 'extension') {
          await page.evaluate(() => localStorage.setItem('lkjstr:settings', '{"language":"ja"}'));
          await page.reload();
          await page.evaluate((origin) => {
            window.uploadTarget = origin;
          }, media.origins.nip96);
          await page.locator(`${compose} textarea`).waitFor();
          await page.setViewportSize({ width: 390, height: 844 });
          media.set('nip96', 'refuse');
          await page.locator(`${compose} input[type=file]`).setInputFiles(file);
          const failed = page.locator(`${compose} .thumb.failed`);
          await failed.waitFor();
          const card = await failed.boundingBox();
          const tile = await page.locator(compose).boundingBox();
          const select = await failed.getByRole('combobox').boundingBox();
          check(
            'upload failure and picker fit a narrow compose tile',
            card &&
              tile &&
              select &&
              card.x >= tile.x &&
              card.x + card.width <= tile.x + tile.width &&
              select.x + select.width <= tile.x + tile.width,
          );
          check(
            'upload failure is plain Japanese with its server',
            (await failed.innerText()).includes('送信') &&
              (await failed.innerText()).includes(media.origins.nip96.replace('https://', '')),
          );
          if (process.env.LKJSTR_SHOTS === '1')
            await page
              .locator(compose)
              .screenshot({ path: smokePath('screens/upload-failed-extension-390-ja.png') });
          media.set('nip96', 'ok');
          await failed.getByRole('button', { name: '再送信', exact: true }).click();
          await page.locator(`${compose} .thumb.done`).waitFor();
          check('upload Japanese retry retains the file');
        }
      } catch (error) {
        console.error(`upload scenario ${signer} ${phase}: ${String(error)}`);
        console.error(
          `upload state: ${await page
            .locator(`${compose} .thumb`)
            .last()
            .getAttribute('class')
            .catch(() => 'absent')}`,
        );
        console.error(
          `upload status: ${await page
            .locator(`${compose} .thumb [role=status]`)
            .last()
            .textContent()
            .catch(() => 'absent')}`,
        );
        throw error;
      } finally {
        bunker.up();
        bunker.refuse(false);
        bunker.hold(false);
        await page.context().close();
      }
    }),
  );
  for (const result of results) if (result.status === 'rejected') throw result.reason;
}
