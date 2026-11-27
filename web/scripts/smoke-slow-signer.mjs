import { writeFile } from 'node:fs/promises';
import { smokePath } from './smoke-output.ts';
import { accounts, compose, launch, setup } from './smoke-signer-support.mjs';

const draft = 'Slow signer paging fixture post';
const bookmark = '.view[data-kind="bookmarks"]:visible';

export async function slowSignerPaging(options) {
  const { check, fake, sign, pubkey } = options;
  const now = Math.floor(Date.now() / 1000);
  const event = (kind, content, tags = [], age = 0) =>
    sign({ pubkey, created_at: now - age, kind, content, tags });
  const tags = [];
  for (let n = 0; n < 100; n++) {
    const note = await event(1, `Slow signer bookmark ${n}`, [], 600 + n);
    tags.push(['e', note.id]);
    fake.add(note);
  }
  // The private portion is deliberately unresolved while the public membership is readable.
  const { value: ciphertext } = await sign({
    fixtureCrypto: { pubkey, operation: 'nip44.encrypt', peer: pubkey, data: '[]' },
  });
  fake.add(await event(10003, ciphertext, tags));
  fake.add(await event(10002, '', [['r', options.relayUrl]]));

  const page = await setup({ ...options, mode: 'slow-sign' });
  try {
    await page.locator('.acct.out').click();
    await page.locator(`${accounts} [data-f="extension"]`).click();
    await page.locator('.acct:not(.out)').waitFor();
    await launch(page, 'Post', 'compose');
    await page.locator(`${compose} textarea`).fill(draft);
    await page.evaluate(() => window.queueSignerBurst());
    await page.waitForFunction(() => window.signerTrace.some((e) => e.phase === 'auth-start'));
    await page.locator(compose).getByRole('button', { name: 'Post', exact: true }).click();
    await page.waitForFunction(() => window.signerTrace.some((e) => e.phase === 'publish-request'));
    await page.evaluate(() => window.releaseSignerBurst());
    await page.waitForFunction(() => window.signerTrace.some((e) => e.phase === 'sign-start'));
    const burst = await page.evaluate(() => window.signerTrace.map((event) => event.phase));
    check(
      'NIP-07 Post overtakes queued background relay authentication',
      burst.filter((phase) => phase === 'auth-start').length === 1 &&
        burst.indexOf('auth-finish') >= 0 &&
        burst.indexOf('auth-finish') < burst.indexOf('sign-start'),
    );
    await page.evaluate(() => window.cancelSignerBurst());
    await page.locator('.tab[data-view="bookmarks"]').click();
    const feed = page.locator(bookmark);
    await feed.locator('.list .note').nth(58).waitFor();
    await page.waitForFunction(() =>
      window.signerTrace.some((e) => e.phase === 'private-state' && e.value === 'loading'),
    );
    await page.evaluate(() => {
      window.signerTrace.push({ phase: 'scroll', at: Math.round(performance.now()) });
    });
    await feed.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const id = tags[80][1];
    const older = feed.locator(`.list .note:is([data-key="${id}"], [data-note="${id}"])`);
    const paged = await older.waitFor({ timeout: 8000 }).then(
      () => true,
      () => false,
    );
    const painted =
      paged &&
      (await older.evaluate(async (note) => {
        note.scrollIntoView({ block: 'nearest' });
        await new Promise((done) => requestAnimationFrame(done));
        await new Promise((done) => requestAnimationFrame(done));
        const row = note.getBoundingClientRect();
        const pane = note.closest('.feed').getBoundingClientRect();
        const visible = row.bottom > pane.top && row.top < pane.bottom;
        window.signerTrace.push({
          phase: 'paint-older',
          at: Math.round(performance.now()),
          value: visible,
        });
        return visible;
      }));
    const during = await page.evaluate(() => window.signerTrace);
    const signPending = !during.some((e) => e.phase === 'sign-finish');
    const anchorAsked = during.some(
      (e, i) =>
        e.phase === 'window' &&
        e.value === 'anchor' &&
        during.slice(0, i).some((e) => e.phase === 'scroll'),
    );
    await launch(page, 'Search', 'search');
    await page.locator('.pane.cur .view[data-kind="search"] input').first().fill('still usable');
    const callsBefore = await page.evaluate(() => {
      window.signerTrace.push({ phase: 'navigation', at: Math.round(performance.now()) });
      return { ...window.signerCalls };
    });
    // A second identity lookup or decrypt inside the pending Post is a separate overlap regression.
    check(
      'NIP-07 pending Post leaves public bookmark paging, paint and navigation usable',
      painted && anchorAsked && signPending,
    );
    check(
      'NIP-07 pending Post runs before lazy private-list work',
      during.some((e) => e.phase === 'private-request') &&
        callsBefore.getPublicKey === 1 &&
        callsBefore.decrypt === 0,
    );
    await launch(page, 'Stats', 'stats');
    const statsAnswered = await page
      .waitForFunction(
        () => {
          const card = document.querySelector('.pane.cur .signer-stats');
          const val = (key) => card?.querySelector(`[data-signer-stat="${key}"]`)?.textContent;
          return (
            val('pending') === '1' &&
            Number(val('callsPerMinute')) >= 2 &&
            val('timeouts') === '0' &&
            /[0-9]+[.][0-9] s/.test(val('latencyMs') ?? '') &&
            card?.textContent?.includes('Your extension is still answering.')
          );
        },
        undefined,
        { timeout: 4500 },
      )
      .then(
        () => true,
        () => false,
      );
    check('NIP-07 signer Stats answers with live load while Post waits', statsAnswered);
    if (statsAnswered && process.env.LKJSTR_SHOTS === '1')
      await page.locator('.pane.cur .signer-stats').screenshot({
        path: smokePath('slow-signer-stats.png'),
      });
    await page.evaluate(() => window.releaseSigner());
    await page.waitForFunction(() => window.signerTrace.some((e) => e.phase === 'publish-signed'));
    await page.waitForFunction(() =>
      window.signerTrace.some((e) => e.phase === 'publish-result' && e.value === true),
    );
    check(
      'NIP-07 delayed Post still reaches the loopback relay',
      fake.published.some((e) => e.content === draft),
    );
    const settledStats =
      statsAnswered &&
      (await page
        .waitForFunction(
          () => {
            const card = document.querySelector('.pane.cur .signer-stats');
            return (
              card?.querySelector('[data-signer-stat="pending"]')?.textContent === '0' &&
              !card?.textContent?.includes('Your extension is still answering.')
            );
          },
          undefined,
          { timeout: 4500 },
        )
        .then(
          () => true,
          () => false,
        ));
    check('NIP-07 signer Stats clears Waiting after the reply', settledStats);
  } finally {
    try {
      await writeFile(
        smokePath('slow-signer-paging.json'),
        JSON.stringify(await page.evaluate(() => window.signerTrace), null, 2),
      );
    } finally {
      await page.context().close();
    }
  }
}
