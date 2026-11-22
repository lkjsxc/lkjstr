// Direct navigation through the production bundle on the loopback app and relay.
import assert from 'node:assert/strict';
import { seedLayouts } from './smoke-seed.mjs';
import { bech32 } from './smoke-visitors.mjs';

const encode = (prefix, fields) => {
  const bytes = Buffer.concat(
    fields.map(([type, value]) => Buffer.concat([Buffer.from([type, value.length]), value])),
  );
  return bech32(prefix, bytes.toString('hex'));
};

const kindBytes = (kind) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(kind);
  return bytes;
};

const articlePointer = (pubkey, identifier, kind = 30023) => {
  return encode('naddr', [
    [0, Buffer.from(identifier)],
    [2, Buffer.from(pubkey, 'hex')],
    [3, kindBytes(kind)],
  ]);
};

export async function deepLinkChecks({
  browser,
  base,
  relayUrl,
  fixture,
  otherAuthor,
  sign,
  add,
  errors,
  check,
}) {
  const { id, pubkey } = fixture.note;
  const identifier = 'deep-link:article';
  const article = (created_at, content, d, author = pubkey) =>
    sign({ kind: 30023, pubkey: author, created_at, content, tags: [['d', d]] });
  const older = await article(1700000000, 'Older article revision', identifier);
  const latest = await article(1700000001, 'Latest article revision', identifier);
  const otherId = await article(1700000002, 'Other identifier', 'other');
  const otherAuthorArticle = await article(1700000003, 'Other author', identifier, otherAuthor);
  const channel = await sign({
    kind: 40,
    pubkey,
    created_at: 1700000000,
    content: '{"name":"Deep link fixture channel"}',
    tags: [],
  });
  const message = await sign({
    kind: 42,
    pubkey,
    created_at: 1700000001,
    content: 'Deep link fixture message',
    tags: [['e', channel.id, relayUrl, 'root']],
  });
  for (const event of [older, latest, otherId, otherAuthorArticle, channel, message]) add(event);

  const note = bech32('note', id);
  const nevent = (id, kind) =>
    encode('nevent', [
      [0, Buffer.from(id, 'hex')],
      [1, Buffer.from(relayUrl)],
      [3, kindBytes(kind)],
    ]);
  const npub = bech32('npub', pubkey);
  const nprofile = encode('nprofile', [
    [0, Buffer.from(pubkey, 'hex')],
    [1, Buffer.from(relayUrl)],
  ]);
  const naddr = articlePointer(pubkey, identifier);
  const global = '.tab.active[data-view="global"]';
  const noteRow = (id) => `.view[data-kind="thread"] [data-note="${id}"]:visible`;
  const profile = '.view[data-kind="profile"] .pname:visible';
  const toast = '.toast';
  const index = await fetch(base).then((response) => response.text());
  assert.equal((await fetch(`${base}/missing-deep-link-asset.js`)).status, 404);

  async function visit(path, accept, hintedOnly = false) {
    const context = await browser.newContext({ locale: 'en-US' });
    try {
      await seedLayouts(context);
      await context.route('**/*', (route) =>
        route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
      );
      await context.addInitScript(
        ({ url, hintedOnly }) => {
          localStorage.setItem(
            'lkjstr:relays:',
            JSON.stringify(hintedOnly ? [] : [{ url, read: true, write: false, search: false }]),
          );
        },
        { url: relayUrl, hintedOnly },
      );
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(String(error)));
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200, path);
      assert.equal(response.url(), base + path, 'SPA must serve the original URL');
      assert.match(response.headers()['content-type'], /^text\/html/);
      assert.equal(await response.text(), index);
      await page.waitForURL(`${base}/`);
      await page.locator('.acct.out').waitFor();
      await accept(page);
    } finally {
      await context.close();
    }
  }

  for (const [label, path, kind, content] of [
    ['note', `/n/${note}`, 'thread', noteRow(id)],
    ['nevent', `/n/${nevent(id, 1)}`, 'thread', noteRow(id)],
    ['channel message', `/n/${nevent(message.id, 42)}`, 'thread', noteRow(message.id)],
    ['npub', `/p/${npub}`, 'profile', profile],
    ['nprofile', `/p/${nprofile}`, 'profile', profile],
    ['naddr', `/a/${naddr}`, 'thread', noteRow(latest.id)],
    ['article ID', `/n/${nevent(latest.id, 30023)}`, 'thread', noteRow(latest.id)],
  ]) {
    await visit(
      path,
      async (page) => {
        const visible = page.locator(content);
        const expected =
          kind === 'profile' ? visible.filter({ hasText: 'engine-fixture' }) : visible;
        await expected.waitFor();
        const tab = page.locator('.tab.active');
        assert.match(await tab.getAttribute('data-view'), new RegExp(`^${kind}(?:$|~)`));
        assert.equal(await page.locator(toast).count(), 0);
        const tabs = await page.locator('.tab').count();
        await page.reload();
        await expected.waitFor();
        await page.locator('.acct.out').waitFor();
        assert.match(await tab.getAttribute('data-view'), new RegExp(`^${kind}(?:$|~)`));
        assert.equal(
          await page.locator('.tab').count(),
          tabs,
          'reload restores exactly one opened tab',
        );
        if (label === 'naddr') {
          for (const e of [older, otherId, otherAuthorArticle])
            assert.equal(await page.locator(noteRow(e.id)).count(), 0);
        }
      },
      label === 'nprofile',
    );
    check(`signed-out ${label} opens exact content on a direct path and survives clean URL reload`);
  }

  const badChecksum = note.slice(0, -1) + (note.endsWith('q') ? 'p' : 'q');
  for (const [label, path] of [
    ['invalid checksum', `/n/${badChecksum}`],
    ['wrong entity', `/p/${note}`],
    ['ephemeral address kind', `/a/${articlePointer(pubkey, identifier, 24133)}`],
    ['private event kind', `/n/${nevent(id, 4)}`],
    ['extra segment', `/n/${note}/extra`],
    ['unknown path', `/x/${npub}`],
  ]) {
    await visit(path, async (page) => {
      const error = page.getByText(
        'That link is not a note, a person or an address lkjstr can open.',
        {
          exact: true,
        },
      );
      await error.waitFor();
      assert.equal(await error.count(), 1);
      assert.equal(await page.locator(global).count(), 1);
      assert.equal(await page.locator('.tab').count(), 1);
      await page.reload();
      await page.locator(global).waitFor();
      assert.equal(await error.count(), 0);
    });
    check(`signed-out ${label} returns to root with one toast and keeps the workspace`);
  }

  await visit(`/a/${articlePointer(pubkey, 'missing')}`, async (page) => {
    const thread = page.locator('.view[data-kind="thread"]:visible');
    await thread.getByText('Nothing here.', { exact: true }).waitFor();
    assert.equal(await page.locator(toast).count(), 0);
  });
  check('unavailable address opens a thread with the existing empty state');
}
