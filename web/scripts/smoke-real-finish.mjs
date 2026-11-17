// Shared-account removal and visitor persistence at the end of the real smoke.
import { accounts } from './smoke-visitors.mjs';
export async function finishAccounts({ page, other, relayUrl, check, launch }) {
  // Signed out again: the visitor's layout returns, here and in the other tab, and stays after a reload.
  await page.locator('.acct').click();
  await page.locator('.menu button', { hasText: 'Accounts' }).click();
  // Removal destroys this button; resolve and dispatch in one browser task.
  await page.locator(`${accounts} [data-f="remove"]`).evaluate((button) => button.click());
  await page.locator('.acct.out').waitFor();
  await other.locator('.acct.out').waitFor();
  const out = async (p) =>
    (await p.locator('.pane').count()) === 1 &&
    (await p.locator('.view[data-kind="home"]').count()) === 0 &&
    (await p.evaluate(() => localStorage.getItem('lkjstr:account'))) === null;
  check('removing the last account signs out everywhere', (await out(page)) && (await out(other)));
  await page.reload();
  await page.locator('.view[data-kind="global"] .note').first().waitFor();
  check('signed out survives a reload', await out(page));
  await launch('Settings', 'settings');
  const relayField = page
    .locator('[data-entry="set.relayList"]')
    .getByLabel('Relay address', { exact: true });
  await relayField.fill(`${relayUrl}/visitor`);
  await relayField.press('Enter');
  await page.waitForTimeout(500);
  check(
    'signed-out relay edit is saved',
    await page.evaluate(
      (url) =>
        JSON.parse(localStorage.getItem('lkjstr:relays:') ?? '[]').some(
          (r) => r.url.replace(/\/$/, '') === url,
        ),
      `${relayUrl}/visitor`,
    ),
  );
  await page.reload();
  await page
    .locator('[data-entry="set.relayList"]')
    .getByLabel('Relay address', { exact: true })
    .waitFor();
  // The form mounts before the engine returns its persisted relay rows.
  const visitorRelay = page.locator(
    `[data-entry="set.relayList"] .rhost[title^="${relayUrl}/visitor"]`,
  );
  await visitorRelay.waitFor();
  check('signed-out relay edit survives reload', (await visitorRelay.count()) === 1);
}

export async function reviewSettings({
  page,
  ctx,
  base,
  fake,
  activePaths,
  mainSockets,
  mainPathsSeen,
  socketProbe,
  check,
  launch,
  shots,
  shot,
}) {
  if (shots) {
    // Signed in, the ordinary layout as it starts, in Japanese (the language is put back afterwards).
    // Use the reader's reset: deleting storage bypasses the live WM store, whose
    // pending save can restore the old layout on pagehide with Home behind Post.
    await page.locator('.pane.cur .strip').getByTitle('Tile menu', { exact: true }).click();
    await page.locator('.menu button').getByText('Reset layout', { exact: true }).click();
    await page.locator('.view[data-kind="home"] .note').first().waitFor();
    check('Reset layout brings Home forward with real notes after Channels and Stats');
    await page.evaluate(() => localStorage.setItem('lkjstr:settings', '{"language":"ja"}'));
    await page.reload();
    await page.locator('.view[data-kind="home"] .note').first().waitFor();
    await page.waitForTimeout(1200);
    check('reset Home survives reload in Japanese', (await page.locator('.pane').count()) === 3);
    await shot(page, 'slice-signedin-1440-ja.png');
    await page.evaluate(() => localStorage.removeItem('lkjstr:settings'));
    await page.reload();
    await page.locator('.view[data-kind="home"] .note').first().waitFor();
  }
  if (shots) check('reset Home survives another reload in English');
  await launch('Settings', 'settings');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  check('settings persist after reload');
  // A cold second tab may paint wholly from the local store and correctly
  // close every idle socket. Start an active-probe and force a genuinely
  // missing search, so socket sharing is checked while there is wire demand.
  socketProbe.active = true;
  for (const [socket, path] of activePaths) {
    if (!mainSockets.has(socket) || path === '/reader') continue;
    socketProbe.seen.add(path);
    const live = (socketProbe.live.get(path) ?? 0) + 1;
    socketProbe.live.set(path, live);
    socketProbe.peak.set(path, live);
  }
  const other = await ctx.newPage();
  await other.goto(base);
  await other.locator('.tab[data-view="global"]').click();
  await other.locator('.view[data-kind="global"] .note').first().waitFor();
  check('second app tab receives notes');
  await launch('Search', 'search');
  const needle = `sharing-probe-${Date.now()}`;
  await page.locator('.view[data-kind="search"] input').first().fill(needle);
  await page.locator('.view[data-kind="search"] input').first().press('Enter');
  for (let n = 0; n < 200 && !fake.searches.includes(needle); n++) await page.waitForTimeout(25);
  check('a fresh want after two tabs reaches the relay', fake.searches.includes(needle));
  const shared = [...socketProbe.peak.values()].every((peak) => peak === 1);
  if (!shared || socketProbe.seen.size === 0 || !mainPathsSeen.has('/owner')) {
    console.error(
      'shared-socket-diagnostic',
      JSON.stringify({
        fakeSockets: fake.connections(),
        active: [...activePaths.values()],
        context: [...mainPathsSeen],
        probe: [...socketProbe.seen],
        peaks: [...socketProbe.peak],
      }),
    );
  }
  check('two app tabs share one socket per relay', shared && socketProbe.seen.size > 0);
  check(
    'learned owner relays survive reload and another tab bootstrap',
    mainPathsSeen.has('/owner') &&
      [...socketProbe.seen].every((path) => path === '/owner' || path === '/'),
  );
  return other;
}

export async function seedRailArchive({ fake, sign, pubkey }) {
  for (let i = 0; i < 100; i++) {
    fake.add(
      await sign({
        pubkey,
        kind: 1,
        created_at: Math.floor(Date.UTC(2026 - Math.floor(i / 20), 10 - (i % 10), 15) / 1000),
        content: `Rail archive fixture ${i}`,
        tags: [],
      }),
    );
  }
}
