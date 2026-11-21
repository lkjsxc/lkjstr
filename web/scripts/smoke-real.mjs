// End-to-end app check. Serve the release with its production CSP; workers can
// reach only the loopback fixture relay. Public HTTP is blocked in all contexts.
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { auditFixtures } from './audit-fixtures.mjs';
import { auditOwner } from './audit-owner.mjs';
import { channelScenarios } from './smoke-channels.mjs';
import { deepLinkChecks } from './smoke-deep-links.mjs';
import { emojiRealChecks, seedEmoji } from './smoke-emoji-real.mjs';
import { smokePath } from './smoke-output.ts';
import { realReaderChecks } from './smoke-reader.mjs';
import { finishAccounts, reviewSettings, seedRailArchive } from './smoke-real-finish.mjs';
import { createRealFixture } from './smoke-real-fixture.mjs';
import { createSmokeResults } from './smoke-real-results.mjs';
import { runRealWishes } from './smoke-real-wishes.mjs';
import { openKeyField, seedLayouts } from './smoke-seed.mjs';
import { signerFace } from './smoke-signer-support.mjs';
import { signerScenarios } from './smoke-signers.mjs';
import { railSmoke } from './smoke-time-rail.ts';
import { uploadScenarios } from './smoke-uploads.mjs';
import { accounts, installExtension, npub, visitorChecks } from './smoke-visitors.mjs';

const errors = [];
const { check, observe, fail, writeReport, finish } = createSmokeResults();
const {
  fixture,
  fixtureSign,
  fake,
  readerFake,
  deepLinkFake,
  bunker,
  media,
  activePaths,
  mainSockets,
  mainPathsSeen,
  socketProbe,
  relayUrl,
  server,
  close,
} = await createRealFixture();
let browser, page;
try {
  const base = await new Promise((done, fail) => {
    server.stdout.once('data', (data) => done(String(data).trim()));
    server.once('exit', (code) => fail(new Error(`server exited ${code}`)));
  });
  browser = await chromium.launch({
    executablePath:
      process.env.LKJSTR_CHROME ??
      `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
    args: ['--no-sandbox', '--disable-background-networking', '--ignore-certificate-errors'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  await ctx.addCookies([{ name: 'lkjstr_smoke_context', value: 'main', url: base }]);
  await seedLayouts(ctx);
  await ctx.route('**/*', (route) =>
    route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
  );
  await ctx.exposeFunction('fixtureSign', fixtureSign);
  await installExtension(ctx, relayUrl, fixture.note.pubkey, errors);
  const shots = process.env.LKJSTR_SHOTS === '1';
  const shot = (p, name) => p.screenshot({ path: smokePath(`screens/${name}`) });
  const { actor, addWish } = await runRealWishes({
    browser,
    base,
    fixture,
    fixtureSign,
    fake,
    relayUrl,
    errors,
    check,
  });
  const scenario = {
    browser,
    base,
    relayUrl,
    pubkey: fixture.note.pubkey,
    sign: fixtureSign,
    errors,
    check,
    fake,
    bunker,
  };
  await signerScenarios(scenario);
  await uploadScenarios({ ...scenario, media });
  const publicationsBeforeApp = fake.published.length;
  await seedRailArchive({ fake, sign: fixtureSign, pubkey: fixture.note.pubkey });
  page = await ctx.newPage();
  const launch = async (word, kind) => {
    await page.locator('.pane.cur .strip').getByTitle('New tab', { exact: true }).click();
    await page.keyboard.type(word);
    await page.locator('.ncard > b').getByText(word, { exact: true }).click();
    await page.locator(`.pane.cur .view[data-kind="${kind}"]:visible`).waitFor();
  };
  await page.goto(base);
  await page.locator('.view[data-kind="global"] .note').first().waitFor();
  check('global renders verified fixture notes');
  await visitorChecks({ page, browser, base, relayUrl, errors, shots, shot, check });
  await deepLinkChecks({
    browser,
    base,
    relayUrl: `${relayUrl}/deep-links`,
    fixture,
    otherAuthor: actor.pubkey,
    sign: fixtureSign,
    add: deepLinkFake.add,
    errors,
    check,
  });
  await openKeyField(page);
  await page.locator(`${accounts} input`).fill('not a key');
  await page.locator(`${accounts} input`).press('Enter');
  await page.locator(`${accounts} .asaid.error`).waitFor();
  check(
    'a wrong key is refused in words, and is gone from the field and the page',
    (await page.locator(`${accounts} input`).inputValue()) === '' &&
      !(await page.locator('body').innerText()).includes('not a key'),
  );
  await page.locator(`${accounts} [data-f="extension"]`).click();
  await page.locator('.view[data-kind="home"] .note').first().waitFor();
  check('home renders signed-in notes');
  await railSmoke(page, check, shots);
  check(
    'signing in brings the ordinary layout',
    (await page.locator('.pane').count()) === 4 &&
      (await page.locator('.acct:not(.out) .av').count()) === 1 &&
      (await page.evaluate(() => typeof JSON.parse(localStorage.getItem('lkjstr:account')))) ===
        'string',
  );
  await page.locator('.view[data-kind="home"] .note .text').first().click();
  await page.locator('.th-focus').waitFor();
  check('note opens as thread');
  await page.locator('.th-focus .name').first().click();
  await page.locator('.profile').waitFor();
  check('profile opens');
  check(
    'protocol 3 exposes all profile kinds',
    (await page.locator('.pkinds [role="tab"]').allTextContents()).join(',') ===
      'Posts,Replies,Reposts,Reactions,Media',
  );
  // A second account that is only a public key: read-only is plain before anything is pressed.
  await page.locator('.acct').click();
  await page.locator('.menu button', { hasText: 'Accounts' }).click();
  await openKeyField(page);
  await page.locator(`${accounts} input`).fill(npub);
  await page.locator(`${accounts} input`).press('Enter');
  await page.locator(`${accounts} .arow`).nth(1).waitFor();
  await page.locator('.acct .ro').waitFor();
  await page.locator('.view[data-kind="compose"] .cwho .badge').first().waitFor();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.note .act.off').length > 0 &&
      document.querySelectorAll('.note .act.a-reply:not(.off)').length === 0,
  );
  await writeFile(
    smokePath('read-only-state.json'),
    JSON.stringify(
      {
        postDisabled: await page
          .locator('.view[data-kind="compose"] .btn.primary:visible')
          .first()
          .isDisabled(),
        off: await page.locator('.note .act.off').count(),
        liveReply: await page
          .locator('.note .act.a-reply:not(.off)')
          .evaluateAll((els) =>
            els.map((el) => ({ view: el.closest('.view')?.dataset.kind, cls: el.className })),
          ),
        faces: await page.locator('.view[data-kind="compose"] .cwho').allTextContents(),
      },
      null,
      2,
    ),
  );
  check(
    'a read-only account says so at the composer and on every action',
    (await page.locator('.view[data-kind="compose"] .btn.primary:visible').first().isDisabled()) &&
      (await page.locator('.note .act.off').count()) > 0 &&
      (await page.locator('.note .act.a-reply:not(.off)').count()) === 0,
  );
  await signerFace(page, 'public-key account switch', check);
  await page.locator('.note .act.a-heart').first().click({ force: true });
  await page.locator('.toast', { hasText: 'read-only' }).waitFor();
  check(
    'a press on a read-only action says why and publishes nothing',
    fake.published.length === publicationsBeforeApp,
  );
  // Switch back from the top bar, then remove the read-only account (it goes at once, with an Undo).
  await page.locator('.acct').click();
  await page.locator('.menu button').nth(1).click();
  await page.waitForFunction(() => !document.querySelector('.acct .ro'));
  check(
    'switching accounts changes who posts',
    (await page.locator('.note .act.off').count()) === 0 &&
      (await page.locator(`${accounts} .arow.on`).count()) === 1,
  );
  await signerFace(page, 'local-key account switch', check);
  await page.locator(`${accounts} .arow:not(.on) [data-f="remove"]`).click();
  await page.locator('.toast.undo', { hasText: 'Removed' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.arow').length === 1);
  check('a read-only account is removed at once');
  await page.locator('.tab.active[data-view^="account"] > .x').click();
  await launch('Search', 'search');
  await page.locator('.view[data-kind="search"] input').first().fill('Engine fixture');
  await page.locator('.view[data-kind="search"] input').first().press('Enter');
  await page.locator('.view[data-kind="search"] .note').first().waitFor();
  for (let n = 0; n < 200 && !fake.searches.includes('Engine'); n++) await page.waitForTimeout(25);
  check('search returns relay result', fake.searches.includes('Engine'));
  await launch('Post', 'compose');
  const text = `real engine smoke ${Date.now()}`;
  await page.locator('.pane.cur .view[data-kind="compose"]:visible textarea').fill(text);
  await page
    .locator('.pane.cur .view[data-kind="compose"]:visible')
    .getByRole('button', { name: 'Post', exact: true })
    .click();
  await page.waitForFunction(() => Boolean(document.querySelector('.csend[data-phase=sent]')));
  check(
    'note signed and published',
    fake.published.some((e) => e.kind === 1 && e.content === text),
  );
  await page.locator('.tab[data-view="global"]').click();
  await page.locator('.view[data-kind="global"] .note').filter({ hasText: text }).waitFor();
  check('published note appears in feed');
  await page
    .locator('.view[data-kind="global"] .note')
    .filter({ hasText: text })
    .locator('.a-heart')
    .click();
  await page.waitForTimeout(8500);
  check(
    'reaction reaches relay',
    fake.published.some((e) => e.kind === 7),
  );
  await seedEmoji({ fake, addWish, owner: fixture.note.pubkey });
  await emojiRealChecks({ page, fake, check, owner: fixture.note.pubkey, launch });
  await channelScenarios({ page, launch, check, fake, shots, shot });
  await auditFixtures({ fake, sign: fixtureSign, owner: fixture.note.pubkey, note: fixture.note });
  check(
    'combined fixture retains the owner audit mute list',
    fake.stored.some(
      (e) =>
        e.kind === 10000 && e.pubkey === fixture.note.pubkey && e.tags.some((t) => t[0] === 'p'),
    ),
  );
  await auditOwner({
    browser,
    base,
    real: true,
    pubkey: fixture.note.pubkey,
    check,
    prepare: async (context) => {
      await context.exposeFunction('fixtureSign', fixtureSign);
      await installExtension(context, relayUrl, fixture.note.pubkey, errors);
    },
  });
  const other = await reviewSettings({
    page,
    ctx,
    base,
    fake,
    activePaths,
    mainSockets,
    mainPathsSeen,
    socketProbe,
    check,
    observe,
    launch,
    shots,
    shot,
  });
  await finishAccounts({ page, other, relayUrl, check, launch });
  await realReaderChecks({
    browser,
    base,
    relayUrl: `${relayUrl}/reader`,
    fake: readerFake,
    fixture,
    fixtureSign,
    check,
    onReader: (reader) => (page = reader),
  });
  check('no page errors', errors.length === 0);
} catch (error) {
  await fail(error, page);
} finally {
  try {
    await writeReport(errors, fake);
  } finally {
    try {
      await browser?.close();
    } finally {
      await close();
    }
  }
}
finish(errors);
