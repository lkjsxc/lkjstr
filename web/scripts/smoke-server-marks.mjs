// Shared by smoke and smoke:real: real Worker, TLS, CORS, persisted-profile reload.
import { mkdir } from 'node:fs/promises';
import { compose, setup } from './smoke-signer-support.mjs';

const entry = '[data-entry="set.servers"]';
export async function saveServers(page, servers) {
  await page.evaluate((servers) => {
    const req = 'marks-' + Date.now();
    window.uploadListResult = undefined;
    window.uploadListReq = req;
    window.uploadPort.postMessage({
      t: 'act',
      req,
      action: {
        a: 'servers.save',
        as: window.uploadAccount,
        servers,
      },
    });
  }, servers);
  await page.waitForFunction(() => window.uploadListResult?.ok);
}
export async function serverMarkScenarios(options) {
  let { page } = options;
  const { media, file, check } = options;
  const postId = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  const origin = media.origins.blossom;
  const settings = async () => {
    await page.locator('.tab[data-view="settings"]').click();
    await page.locator(entry).waitFor();
  };
  const post = () => page.locator(`.tab[data-view="${postId}"]`).click();
  const row = (url = origin) =>
    page.locator(`${entry} .srow`).filter({ has: page.locator(`span[title="${url}"]`) });
  await saveServers(page, [origin]);
  await page.locator(`${compose} input[type=file]`).setInputFiles(file);
  await page.locator(`${compose} .thumb.done`).waitFor();
  await settings();
  await row().locator('[data-state=answering]', { hasText: 'Blossom' }).waitFor();
  check(
    'media root without CORS and working PUT is answering',
    !media.requests.some((r) => r.path === '/' || r.method === 'HEAD'),
  );
  // Retain an explicit browser CORS observation too; it must not alter the row.
  check(
    'media root actually refuses browser CORS',
    await page.evaluate(async (url) => {
      try {
        await fetch(url);
        return false;
      } catch {
        return true;
      }
    }, origin),
  );
  check('root CORS failure never changes server mark', (await row().locator('.bad').count()) === 0);
  await post();
  await page.locator(`${compose} .thumb button.x`).click();
  media.set('blossom', 'dead');
  await page.locator(`${compose} input[type=file]`).setInputFiles(file);
  await page.locator(`${compose} .thumb.failed`).waitFor();
  const reason = await page.locator(`${compose} .thumb.failed [role=status]`).innerText();
  await settings();
  await row().locator('.bad', { hasText: 'Not answering' }).waitFor();
  const title = await row().locator('.bad').getAttribute('title');
  check(
    'required upload failure marks down with the compose reason',
    !!title && reason.includes(title),
  );
  // A fresh load has saved account/list/draft data, but no durable down verdict.
  await page.waitForTimeout(2000); // wait for bounded account/event and WM persistence
  const storageState = await page.context().storageState({ indexedDB: true });
  await page.context().close();
  page = await setup({
    ...options,
    storageState,
    mode: 'upload',
    mediaOrigins: Object.values(media.origins),
  });
  await settings();
  await row().waitFor();
  check(
    'saved state with an old down verdict loads as unknown',
    (await row().locator('.bad').count()) === 0 &&
      (await row().innerText()).includes('Not confirmed'),
  );
  await post();
  await page.locator(`${compose} input[type=file]`).setInputFiles(file);
  await page.locator(`${compose} .thumb.failed`).waitFor();
  check(
    'compose picker shares the fresh down mark',
    await page
      .waitForFunction(() =>
        [...document.querySelectorAll('.thumb select option:checked')].some((o) =>
          o.textContent.includes('Not answering'),
        ),
      )
      .then(() => true),
  );
  await settings();
  media.set('blossom', 'no-head');
  await row().getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction((origin) => {
    const row = document.querySelector(`span[title="${origin}"]`)?.parentElement;
    return row && !row.querySelector('.bad');
  }, origin);
  check(
    'optional unsupported BUD-06 never marks down',
    (await row().locator('.bad').count()) === 0,
  );
  await post();
  await page.locator(`${compose} .thumb.failed button.btn`).click();
  await page.locator(`${compose} .thumb.done`).waitFor();
  await page.locator(`${compose} .thumb button.x`).click();
  media.set('blossom', 'dead');
  await page.locator(`${compose} input[type=file]`).setInputFiles(file);
  await page.locator(`${compose} .thumb.failed`).waitFor();
  await settings();
  media.set('blossom', 'ok');
  await row().getByRole('button', { name: 'Retry', exact: true }).click();
  await row().locator('[data-state=answering]', { hasText: 'Blossom' }).waitFor();
  check(
    'row retry recovers when BUD-06 answers again',
    (await row().locator('.bad').count()) === 0,
  );
  // Required discovery failures stay down, and retry uses that same discovery.
  await saveServers(page, [media.origins.nip96]);
  await post();
  await page.locator(`${compose} .thumb button.x`).click();
  await page.locator(`${compose} input[type=file]`).setInputFiles(file);
  await page.locator(`${compose} .thumb.done`).waitFor();
  await page.locator(`${compose} .thumb button.x`).click();
  media.set('nip96', 'dead');
  await page.locator(`${compose} input[type=file]`).setInputFiles(file);
  // Fresh previous down verdicts are skipped for implicit selection; explicit retry still tests the host.
  await page.locator(`${compose} .thumb.failed`).waitFor();
  await settings();
  await row(media.origins.nip96).locator('.bad').waitFor();
  media.set('nip96', 'ok');
  await row(media.origins.nip96).getByRole('button', { name: 'Retry', exact: true }).click();
  await row(media.origins.nip96).locator('[data-state=answering]', { hasText: 'NIP-96' }).waitFor();
  check('required NIP-96 discovery retry recovers');
  // The first live candidate fails and is marked; the second completes this same upload.
  await saveServers(page, [origin, media.origins.nip96]);
  await post();
  await page.locator(`${compose} .thumb button.x`).click();
  media.set('blossom', 'dead');
  const start = media.requests.length;
  await page.locator(`${compose} input[type=file]`).setInputFiles(file);
  await page.locator(`${compose} .thumb.done`).waitFor();
  check(
    'implicit upload uses first answering server by the row evidence',
    media.requests.slice(start).some((r) => r.protocol === 'nip96' && r.valid),
  );
  await settings();
  await row().locator('.bad').waitFor();
  await row(media.origins.nip96).locator('[data-state=answering]', { hasText: 'NIP-96' }).waitFor();
  check('fallback success and first-server failure share Settings marks');
  await post();
  await page.locator(`${compose} .thumb button.x`).click();
  await settings();
  if (process.env.LKJSTR_SHOTS === '1') {
    await saveServers(page, [origin, media.origins.nip96, 'https://blossom.band']);
    await mkdir('tmp/shots', { recursive: true });
    await page.getByLabel('Theme', { exact: true }).selectOption('dark');
    await page.waitForTimeout(500); // finish the WM's bounded save before a second app page
    const layout = await page.evaluate(() => localStorage.getItem('lkjstr:layout:main'));
    const shot = await page.context().newPage();
    await shot.addInitScript(() =>
      localStorage.setItem(
        'lkjstr:layout:main',
        JSON.stringify({
          type: 'pane',
          id: 'server-review',
          tabs: ['settings'],
          active: 'settings',
        }),
      ),
    );
    try {
      await shot.goto(options.base);
      await shot.locator(`${entry} [data-state=failed]`).waitFor();
      for (const width of [1440, 390]) {
        await shot.setViewportSize({ width, height: 900 });
        await shot.locator(entry).scrollIntoViewIfNeeded();
        await shot.screenshot({ path: `tmp/shots/servers-${width}-dark.png` });
      }
      check('server marks agree in a second app page');
    } finally {
      await shot.close();
      // Closing the capture flushes its layout; restore ours afterwards, including the live WM.
      await page.evaluate((layout) => {
        const key = 'lkjstr:layout:main';
        localStorage.setItem(key, layout);
        dispatchEvent(new StorageEvent('storage', { key, newValue: layout }));
      }, layout);
      await page.locator(`.tab[data-view="${postId}"]`).waitFor();
    }
  }
  media.set('blossom', 'ok');
  await post();
  return page;
}
