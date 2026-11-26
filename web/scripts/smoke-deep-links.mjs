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

export const profilePointer = (pubkey, relayUrl) =>
  encode('nprofile', [
    [0, Buffer.from(pubkey, 'hex')],
    [1, Buffer.from(relayUrl)],
  ]);

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
  const genericId = 'deep-link:session';
  const session = (created_at, content) =>
    sign({
      kind: 30311,
      pubkey,
      created_at,
      content,
      tags: [
        ['d', genericId],
        ['alt', 'Public session'],
        ['t', 'nostr'],
      ],
    });
  const oldSession = await session(1700000000, 'Previous session edition');
  const liveSession = await session(1700000001, 'Current public session edition');
  const publicAct = await sign({
    kind: 7,
    pubkey,
    created_at: 1700000003,
    content: '+',
    tags: [
      ['e', id],
      ['k', '1'],
    ],
  });
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
  for (const event of [
    older,
    latest,
    otherId,
    otherAuthorArticle,
    channel,
    message,
    oldSession,
    liveSession,
    publicAct,
  ])
    add(event);

  const note = bech32('note', id);
  const badChecksum = note.slice(0, -1) + (note.endsWith('q') ? 'p' : 'q');
  const nevent = (id, kind) =>
    encode('nevent', [
      [0, Buffer.from(id, 'hex')],
      [1, Buffer.from(relayUrl)],
      [3, kindBytes(kind)],
    ]);
  const npub = bech32('npub', pubkey);
  const nprofile = profilePointer(pubkey, relayUrl);
  const naddr = articlePointer(pubkey, identifier);
  const global = '.tab.active[data-view="global"]';
  const noteRow = (id) => `.view[data-kind="thread"] [data-note="${id}"]:visible`;
  const profile = '.view[data-kind="profile"] .pname:visible';
  const toast = '.toast';
  const index = await fetch(base).then((response) => response.text());
  assert.equal((await fetch(`${base}/missing-deep-link-asset.js`)).status, 404);
  for (const path of ['/en/about.html', '/ja/about.html', '/privacy.html']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.notEqual(await response.text(), index, path);
  }

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
    ['bare nevent', `/${nevent(id, 1)}`, 'thread', noteRow(id)],
    ['bare npub', `/${npub}`, 'profile', profile],
    ['nostr URI path', `/nostr:${naddr}`, 'thread', noteRow(latest.id)],
    ['note', `/n/${note}`, 'thread', noteRow(id)],
    ['nevent', `/n/${nevent(id, 1)}`, 'thread', noteRow(id)],
    ['channel message', `/n/${nevent(message.id, 42)}`, 'thread', noteRow(message.id)],
    ['npub', `/p/${npub}`, 'profile', profile],
    ['nprofile', `/p/${nprofile}`, 'profile', profile],
    ['naddr', `/a/${naddr}`, 'thread', noteRow(latest.id)],
    ['article ID', `/n/${nevent(latest.id, 30023)}`, 'thread', noteRow(latest.id)],
    [
      'generic public event ID',
      `/n/${nevent(liveSession.id, 30311)}`,
      'thread',
      noteRow(liveSession.id),
    ],
    [
      'generic public naddr',
      `/a/${articlePointer(pubkey, genericId, 30311)}`,
      'thread',
      noteRow(liveSession.id),
    ],
    ['public act ID', `/n/${nevent(publicAct.id, 7)}`, 'thread', noteRow(publicAct.id)],
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
        assert.equal(tabs, 2, 'opening a direct path adds one tab to the seeded workspace');
        await page.reload();
        await expected.waitFor();
        await page.locator('.acct.out').waitFor();
        assert.match(await tab.getAttribute('data-view'), new RegExp(`^${kind}(?:$|~)`));
        assert.equal(
          await page.locator('.tab').count(),
          tabs,
          'reload restores exactly one opened tab',
        );
        if (label === 'generic public event ID' || label === 'generic public naddr') {
          await page.locator(`${noteRow(liveSession.id)} .generic-face`).waitFor();
          assert.equal(await page.locator(`${noteRow(oldSession.id)}`).count(), 0);
        }
        if (label === 'public act ID')
          assert.equal(await visible.locator('.acts, .chips').count(), 0);
        if (label === 'naddr') {
          for (const e of [older, otherId, otherAuthorArticle])
            assert.equal(await page.locator(noteRow(e.id)).count(), 0);
        }
      },
      label === 'nprofile',
    );
    check(`signed-out ${label} opens exact content on a direct path and survives clean URL reload`);
  }

  await visit(`/${nevent(id, 1)}`, async (page) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const row = page.locator(noteRow(id));
    await row.locator('.a-more').click();
    await page.getByText('Copy lkjstr link', { exact: true }).click();
    await page.getByText('Copied', { exact: true }).waitFor();
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    const reference = encode('nevent', [
      [0, Buffer.from(id, 'hex')],
      [1, Buffer.from(relayUrl)],
      [2, Buffer.from(pubkey, 'hex')],
      [3, kindBytes(1)],
    ]);
    assert.equal(shared, `https://lkjstr.lkjsxc.com/${reference}`);
    check('Copy lkjstr link includes the exact event and its observed relay');

    const newTab = () => page.locator('.pane.cur .strip').getByTitle('New tab', { exact: true });
    const input = page.locator('.view.launcher:visible > input');
    for (const [text, target] of [
      [shared, noteRow(id)],
      [`https://njump.me/${naddr}`, noteRow(latest.id)],
      [`https://nostter.app/${nprofile}`, profile],
      [`nostr:${note}`, noteRow(id)],
    ]) {
      const tabs = await page.locator('.tab').count();
      await newTab().click();
      await input.fill(text);
      await input.press('Enter');
      await page.locator(target).waitFor();
      assert.equal(await page.locator('.tab').count(), tabs + 1);
      assert.equal(await page.locator('.view.launcher').count(), 0);
    }
    check('New tab accepts an lkjstr share, an njump address and a nostter profile');
    await newTab().click();
    await input.fill(`https://njump.me/${badChecksum}`);
    await input.press('Enter');
    await page.locator(toast).filter({ hasText: 'That link is not a note' }).waitFor();
    assert.equal(await input.inputValue(), `https://njump.me/${badChecksum}`);
    check('New tab keeps the input after the Worker rejects a pasted link');
  });

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
  await visit(`/n/${nevent('f'.repeat(64), 30311)}`, async (page) => {
    const thread = page.locator('.view[data-kind="thread"]:visible');
    await thread.getByText('Nothing here.', { exact: true }).waitFor();
    assert.equal(await thread.locator('[data-note]').count(), 0);
    assert.equal(await page.locator(toast).count(), 0);
  });
  check('unavailable generic event ID opens a thread with the existing empty state');
}
