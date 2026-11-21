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
async function setup({
  browser,
  base,
  relayUrl,
  pubkey,
  mode,
  sign,
  errors,
  bunker,
  mediaOrigins = [],
  storageState,
}) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    storageState,
  });
  await seedLayouts(ctx);
  await ctx.route('**/*', (route) =>
    route.request().url().startsWith(`${base}/`) ||
    mediaOrigins.some((origin) => route.request().url().startsWith(`${origin}/`))
      ? route.continue()
      : route.abort(),
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
      const observe = (port) => {
        const post = port.postMessage.bind(port);
        port.postMessage = (m, ...args) => {
          if (m.t === 'act' && m.action.a === 'upload' && window.uploadTarget && !m.action.server)
            m.action.server = window.uploadTarget;
          return post(m, ...args);
        };
        port.addEventListener('message', ({ data: m }) => {
          if (m.t === 'accounts') {
            window.uploadAccount = m.active;
            if (m.active)
              localStorage.setItem(
                `lkjstr:relays:${m.active}`,
                JSON.stringify([{ url: relayUrl, read: true, write: true, search: true }]),
              );
          }
          if (m.t === 'result' && m.req === window.uploadListReq) window.uploadListDone = m.ok;
          if (m.t === 'result' && m.req === window.uploadListReq)
            window.uploadListResult = { ok: m.ok, code: m.error?.code };
          if (m.t === 'result') window.signerResults.push({ ok: m.ok, code: m.error?.code });
        });
      };
      const Shared = window.SharedWorker;
      window.SharedWorker = class extends Shared {
        constructor(...args) {
          super(...args);
          observe(this.port);
          window.uploadPort = this.port;
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
          if (window.uploadSignMode === 'refuse')
            return Promise.reject(new Error('fixture refusal'));
          if (window.uploadSignMode === 'hang') return new Promise(() => {});
          return answer('sign', () =>
            window.fixtureSign(
              window.uploadSignMode === 'wrong' ? { ...event, content: 'changed auth' } : event,
            ),
          );
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

export async function signerFace(page, label, check) {
  await page.waitForFunction(() => {
    const top = document.querySelector('.acct [data-face]');
    const posting = document.querySelector('.view[data-kind="compose"] .cwho [data-face]');
    const account = document.querySelector('.arow.on [data-face]');
    return (
      top &&
      posting &&
      top.dataset.face === posting.dataset.face &&
      (!account || account.dataset.face === top.dataset.face)
    );
  });
  check(`wish-7 ${label} draws the active account face in the bar and composer`);
}
