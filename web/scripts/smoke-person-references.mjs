import assert from 'node:assert/strict';
import { profilePointer } from './smoke-deep-links.mjs';
import { openKeyField } from './smoke-seed.mjs';
import { accounts, bech32 } from './smoke-visitors.mjs';

export async function personReferenceChecks({
  browser,
  base,
  relayUrl,
  fixture,
  sign,
  add,
  errors,
  check,
}) {
  const actor = await sign({ fixtureActor: true });
  const createdAt = fixture.note.created_at;
  const malformed = await sign({
    pubkey: actor.pubkey,
    kind: 0,
    created_at: createdAt,
    tags: [],
    content: JSON.stringify(fixture.note),
  });
  const note = await sign({
    pubkey: actor.pubkey,
    kind: 1,
    created_at: createdAt + 1,
    tags: [],
    content: 'A note found through this person reference.',
  });
  const owner = fixture.note.pubkey;
  add(
    await sign({
      pubkey: owner,
      kind: 10002,
      created_at: createdAt,
      tags: [['r', relayUrl, 'read']],
      content: '',
    }),
  );
  add(malformed);
  add(note);

  const npub = bech32('npub', actor.pubkey);
  const shortNpub = `${npub.slice(0, 10)}…${npub.slice(-4)}`;
  for (const signed of [false, true]) {
    for (const [source, ref] of [
      ['profile', npub],
      ['their-home', profilePointer(actor.pubkey, relayUrl)],
    ]) {
      const context = await browser.newContext({
        locale: 'en-US',
        viewport: { width: 1440, height: 900 },
      });
      try {
        await context.route('**/*', (route) =>
          route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
        );
        await context.addInitScript(
          ({ owner, relayUrl }) => {
            const opened = new Map();
            const ports = new WeakSet();
            const focused = new Set();
            globalThis.personReferenceFocus = focused;
            const post = MessagePort.prototype.postMessage;
            MessagePort.prototype.postMessage = function (message, ...args) {
              if (!ports.has(this)) {
                ports.add(this);
                this.addEventListener('message', ({ data }) => {
                  if (data?.t === 'ready') globalThis.personReferenceReady = true;
                });
              }
              if (message?.t === 'open') opened.set(message.sub, message.query.source);
              if (message?.t === 'close') opened.delete(message.sub);
              if (message?.t === 'hint') focused.add(opened.get(message.hint.focusedSub));
              return post.call(this, message, ...args);
            };
            const put = (key, value) =>
              localStorage.setItem(`lkjstr:${key}`, JSON.stringify(value));
            const pane = (id, kind) => ({ type: 'pane', id, tabs: [kind], active: kind });
            const relays = [{ url: relayUrl, read: true, write: false, search: false }];
            put('migration', 'owner-audit-1');
            put('relays:', relays);
            put(`relays:${owner}`, relays);
            put('layout:guest', pane('visitor', 'docs'));
            put('layout:main', {
              type: 'split',
              id: 'root',
              dir: 'row',
              sizes: [0.5, 0.5],
              children: [pane('home-pane', 'home'), pane('docs-pane', 'docs')],
            });
          },
          { owner, relayUrl },
        );
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(String(error)));
        await page.goto(base);
        await page.locator('.acct.out').waitFor();
        await page.waitForFunction(() => globalThis.personReferenceReady === true);
        if (signed) {
          await page.locator('.acct.out').click();
          await openKeyField(page);
          await page.locator(`${accounts} input`).fill(bech32('npub', owner));
          await page.locator(`${accounts} input`).press('Enter');
          await page.locator('.acct .ro').waitFor();
          await page.locator(`.view[data-kind="home"] [data-note="${fixture.note.id}"]`).waitFor();
          await page.locator('.tab[data-view="docs"]').click();
        }
        await page.getByRole('button', { name: 'Search tabs', exact: true }).click();
        await page.locator('.tsearch input').fill(ref);
        const choice = page
          .locator('.tsearch [role="option"]')
          .filter({ hasText: source === 'profile' ? 'Open ' : 'Home' })
          .first();
        await choice.click({ timeout: 5000 }).catch(async (error) => {
          const offered = await page.locator('.tsearch [role="option"]').allTextContents();
          throw new Error(`${source} reference choices: ${offered.join(', ')}`, { cause: error });
        });
        const view = page.locator(`.view[data-kind="${source}"]:visible`);
        const row = view.locator(`[data-note="${note.id}"]`);
        await view.waitFor({ timeout: 10000 }).catch(async (error) => {
          const tabs = await page.locator('.tab.active').allTextContents();
          const toast = await page.locator('.toast').allTextContents();
          throw new Error(`${source} did not open. Active tabs: ${tabs}. Notice: ${toast}`, {
            cause: error,
          });
        });
        await page.waitForFunction(
          (source) => globalThis.personReferenceFocus.has(source),
          source,
          {
            timeout: 5000,
          },
        );
        await row.waitFor({ timeout: 12000 });
        await page.waitForFunction(
          (id) =>
            new Promise((resolve) => {
              const open = indexedDB.open('lkjstr-wasm');
              open.onerror = () => resolve(false);
              open.onsuccess = () => {
                const db = open.result;
                const read = db.transaction('events').objectStore('events').getKey(id);
                read.onsuccess = () => resolve(read.result === id);
                read.onerror = () => resolve(false);
                db.close();
              };
            }),
          malformed.id,
        );
        await row.getByText(shortNpub, { exact: true }).waitFor();
        if (source === 'profile')
          await view.locator('.pname').filter({ hasText: shortNpub }).waitFor();
        assert.equal(
          await view.getByText('No relay could be reached.', { exact: true }).count(),
          0,
        );
        assert.equal(await page.locator('.toast').count(), 0);
        check(
          `${signed ? 'read-only' : 'signed-out'} ${source} reference loads notes with a quiet npub fallback`,
        );
      } finally {
        await context.close();
      }
    }
  }
}
