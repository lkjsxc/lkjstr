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
      window.uploadPostCalls = { publish: 0, sign: 0 };
      const slow = mode === 'slow-sign';
      const p2 = mode?.startsWith('p2-');
      window.signerTrace = [];
      const trace = (phase, value) => {
        if ((slow || p2) && window.signerTrace.length < 200)
          window.signerTrace.push({ phase, at: Math.round(performance.now()), value });
      };
      let bookmarkSub, publishReq, releaseAuth;
      const fakeAuthIds = Array.from({ length: 8 }, (_, n) => `fixture-auth-${n}`);
      const authGate = new Promise((done) => {
        releaseAuth = done;
      });
      if (slow) {
        const fromWorker = (data) =>
          window.uploadPort.onmessage(new MessageEvent('message', { data }));
        window.queueSignerBurst = () => {
          for (const req of fakeAuthIds) {
            const event = {
              pubkey,
              created_at: Math.floor(Date.now() / 1000),
              kind: 22242,
              content: '',
              tags: [
                ['relay', relayUrl],
                ['challenge', req],
              ],
            };
            fromWorker({ t: 'sign', req, pubkey, event: JSON.stringify(event) });
          }
        };
        window.releaseSignerBurst = releaseAuth;
        window.cancelSignerBurst = () => {
          for (const req of fakeAuthIds) fromWorker({ t: 'sign.cancel', req });
        };
      }
      const observe = (port) => {
        const post = port.postMessage.bind(port);
        port.postMessage = (m, ...args) => {
          if (slow && m.t === 'signed' && fakeAuthIds.includes(m.req)) return;
          if (m.t === 'act' && m.action.a === 'upload' && window.uploadTarget && !m.action.server)
            m.action.server = window.uploadTarget;
          if (mode === 'upload' && m.t === 'act' && m.action.a === 'publish')
            window.uploadPostCalls.publish++;
          if (slow && m.t === 'open' && m.query.source === 'bookmarks') bookmarkSub = m.sub;
          if ((slow || p2) && m.t === 'act' && m.action.a === 'publish') {
            publishReq = m.req;
            trace('publish-press');
          }
          if (p2 && m.t === 'signed') trace('signed-answer', m.error ?? 'signature');
          if (p2 && m.t === 'publicKey') trace('discovery-answer', m.error ?? 'pubkey');
          if (slow && m.t === 'window' && m.sub === bookmarkSub)
            trace('window', m.anchor === 'top' ? 'top' : 'anchor');
          return post(m, ...args);
        };
        port.addEventListener('message', ({ data: m }) => {
          if (slow && m.sub === bookmarkSub) {
            if (m.t === 'rows') trace('rows', m.rows.length);
            if (m.t === 'state' && m.state.privateLists)
              trace('private-state', m.state.privateLists.phase);
          }
          if (m.t === 'crypt' && m.context?.kind === 'private-list') trace('private-request');
          if (m.t === 'publish.signed') trace('publish-signed');
          if ((slow || p2) && m.t === 'sign' && m.req === publishReq) trace('publish-request');
          if ((slow || p2) && m.t === 'result' && m.req === publishReq)
            trace('publish-result', m.ok);
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
        if (p2) {
          trace(`${phase}-start`);
          const ms =
            (mode === 'p2-slow-discover' && phase === 'discover') ||
            (mode === 'p2-slow-sign' && phase === 'sign')
              ? 20000
              : 50;
          return new Promise((done) => setTimeout(done, ms)).then(async () => {
            trace(`${phase}-finish`);
            if (mode === 'p2-refuse' && phase === 'sign') throw new Error('fixture refusal');
            const result = await value();
            trace(`${phase}-resolved`);
            return result;
          });
        }
        if (mode === `reject-${phase}`) return Promise.reject(new Error('fixture refusal'));
        if (mode === `hang-${phase}`) return new Promise(() => {});
        if (slow) {
          trace(`${phase}-start`);
          const delay = new Promise((done) => setTimeout(done, phase === 'discover' ? 1500 : 5000));
          const held =
            phase === 'sign'
              ? new Promise((done) => {
                  window.releaseSigner = done;
                })
              : undefined;
          return Promise.all([delay, held]).then(async () => {
            const result = await value();
            trace(`${phase}-finish`);
            return result;
          });
        }
        return Promise.resolve(value());
      };
      const heldDecrypt = () => {
        window.signerCalls.decrypt++;
        trace('decrypt-start');
        return new Promise(() => {});
      };
      const unsupported = () => {
        window.signerCalls.decrypt++;
        throw new Error('unused decrypt capability');
      };
      const extension = {
        getPublicKey() {
          window.signerCalls.getPublicKey++;
          return answer('discover', () => pubkey);
        },
        signEvent(event) {
          window.signerCalls.signEvent++;
          if (mode === 'upload' && event.kind === 1) {
            window.uploadPostCalls.sign++;
            if (window.holdUploadPost)
              return new Promise((done) => {
                window.releaseUploadPost = () => done(window.fixtureSign(event));
              });
          }
          if (slow && event.kind === 22242) {
            trace('auth-start');
            const delay = new Promise((done) => setTimeout(done, 1500));
            return Promise.all([delay, authGate]).then(() => {
              trace('auth-finish');
              return window.fixtureSign(event);
            });
          }
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
        nip44: { encrypt: unsupported, decrypt: slow ? heldDecrypt : unsupported },
      };
      if (mode === 'p2-late')
        window.addEventListener(
          'load',
          () => {
            trace('load');
            setTimeout(() => {
              window.nostr = extension;
              trace('injected');
            }, 1500);
          },
          { once: true },
        );
      else window.nostr = extension;
      if (p2) {
        const observed = new Set();
        const watch = () => {
          for (const key of [
            'Looking for your signer extension',
            'Waiting for your extension. Approve there',
          ]) {
            if (document.body?.textContent.includes(key) && !observed.has(key)) {
              observed.add(key);
              trace('wait-words', key);
            }
          }
        };
        new MutationObserver(watch).observe(document, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }
    },
    { relayUrl, pubkey, mode, bunkerKey: bunker.pubkey },
  );
  const page = await ctx.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(base);
  if (mode === 'p2-late') await page.locator('.acct.out').waitFor();
  else await page.locator('.view[data-kind="global"] .note').first().waitFor();
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
