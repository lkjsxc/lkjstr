import { mkdir, writeFile } from 'node:fs/promises';
import { seedLayouts } from './smoke-seed.mjs';

// Shared loopback-only real-product signer helpers. No action/key payloads are recorded.
const accounts = '.view[data-kind="account"]';
const compose = '.pane.cur .view[data-kind="compose"]:visible';
async function launch(page, word, kind) {
  await page.locator('.pane.cur .strip').getByTitle('New tab', { exact: true }).click();
  await page.keyboard.type(word);
  await page.locator('.ncard > b').getByText(word, { exact: true }).click();
  await page.locator(`.pane.cur .view[data-kind="${kind}"]:visible`).waitFor();
}
async function setup({ browser, base, relayUrl, pubkey, mode, sign, errors, bunker }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  await seedLayouts(ctx);
  await ctx.route('**/*', (route) =>
    route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
  );
  await ctx.exposeFunction('fixtureSign', sign);
  await ctx.addInitScript(
    ({ relayUrl, pubkey, mode, bunkerKey }) => {
      if (location.protocol !== 'http:') return;
      for (const key of ['', pubkey, bunkerKey])
        localStorage.setItem(
          `lkjstr:relays:${key}`,
          JSON.stringify([{ url: relayUrl, read: true, write: true, search: true }]),
        );
      window.signerResults = [];
      window.signerCalls = { getPublicKey: 0, signEvent: 0, decrypt: 0 };
      const observe = (port) =>
        port.addEventListener('message', ({ data: m }) => {
          if (m.t === 'result') window.signerResults.push({ ok: m.ok, code: m.error?.code });
        });
      const Shared = window.SharedWorker;
      window.SharedWorker = class extends Shared {
        constructor(...args) {
          super(...args);
          observe(this.port);
        }
      };
      const Worker = window.Worker;
      window.Worker = class extends Worker {
        constructor(...args) {
          super(...args);
          observe(this);
        }
      };
      const answer = (phase, value) => {
        if (mode === `reject-${phase}`) return Promise.reject(new Error('fixture refusal'));
        if (mode === `hang-${phase}`) return new Promise(() => {});
        return Promise.resolve(value());
      };
      const unsupported = () => {
        window.signerCalls.decrypt++;
        throw new Error('unused decrypt capability');
      };
      window.nostr = {
        getPublicKey() {
          window.signerCalls.getPublicKey++;
          return answer('discover', () => pubkey);
        },
        signEvent(event) {
          window.signerCalls.signEvent++;
          return answer('sign', () => window.fixtureSign(event));
        },
        nip04: { encrypt: unsupported, decrypt: unsupported },
        nip44: { encrypt: unsupported, decrypt: unsupported },
      };
    },
    { relayUrl, pubkey, mode, bunkerKey: bunker.pubkey },
  );
  const page = await ctx.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(base);
  await page.locator('.view[data-kind="global"] .note').first().waitFor();
  return page;
}
const code = (page, expected) =>
  page.waitForFunction(
    (expected) => window.signerResults.some((r) => !r.ok && r.code === expected),
    expected,
    { timeout: 75000 },
  );

export { accounts, code, compose, launch, setup };

export async function writeReport(checks, errors, fake) {
  await mkdir('tmp/smoke-real', { recursive: true });
  await writeFile(
    'tmp/smoke-real/report.json',
    JSON.stringify(
      {
        checks,
        errors,
        publications: fake.published.map((e) => ({ id: e.id, kind: e.kind })),
        searches: fake.searches,
      },
      null,
      2,
    ),
  );
}
