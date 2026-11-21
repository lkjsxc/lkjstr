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

/** The default a reset gives at 1440px (wm/presets.ts): Home with Global behind it, Notifications, then Post over
 * Accounts and Settings. Each tile's tabs in order, its front tab starred. The seeded layout has four tiles too. */
const RESET_1440 = ['home* global', 'notifications*', 'compose*', 'account* settings'];
/** Workspace 1 as drawn and as stored for the signed-in reader, with the page language and Home's tab title. */
const arrangement = (page) =>
  page.evaluate(() => {
    const line = (tabs, active) => tabs.map((v) => `${v}${v === active ? '*' : ''}`).join(' ');
    const walk = (n) => (n.type === 'pane' ? [n] : n.children.flatMap(walk));
    const raw = localStorage.getItem('lkjstr:layout:main');
    return {
      drawn: [...document.querySelectorAll('.pane')].map((p) => {
        const tabs = [...p.querySelectorAll('.tab')];
        return line(
          tabs.map((t) => t.dataset.view),
          tabs.find((t) => t.classList.contains('active'))?.dataset.view,
        );
      }),
      stored: raw === null ? null : walk(JSON.parse(raw)).map((p) => line(p.tabs, p.active)),
      lang: document.documentElement.lang,
      home: document.querySelector('.tab[data-view="home"]')?.title,
    };
  });
/** Whether the reset default is drawn (and, unless `stored` is false, also stored) in `lang` with Home titled `home`. */
async function resetShown(page, lang, home, stored = true) {
  const a = await arrangement(page);
  const ok =
    a.drawn.join() === RESET_1440.join() &&
    (!stored || a.stored?.join() === RESET_1440.join()) &&
    a.lang === lang &&
    a.home === home;
  if (!ok) console.error('reset-layout-diagnostic', JSON.stringify({ want: RESET_1440, ...a }));
  return ok;
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
  observe,
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
    // Its save is still pending here: the stored layout follows on pagehide, and each reload must read it back.
    check(
      'Reset layout brings Home forward with real notes after Channels and Stats',
      await resetShown(page, 'en', 'Home', false),
    );
    await page.evaluate(() => localStorage.setItem('lkjstr:settings', '{"language":"ja"}'));
    await page.reload();
    await page.locator('.view[data-kind="home"] .note').first().waitFor();
    await page.waitForTimeout(1200);
    check('reset Home survives reload in Japanese', await resetShown(page, 'ja', 'ホーム'));
    await shot(page, 'slice-signedin-1440-ja.png');
    await page.evaluate(() => localStorage.removeItem('lkjstr:settings'));
    await page.reload();
    await page.locator('.view[data-kind="home"] .note').first().waitFor();
    check('reset Home survives another reload in English', await resetShown(page, 'en', 'Home'));
  }
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
  // Same-workspace edits deliberately synchronize. Wait for that round trip
  // before opening a second, independent demand in another workspace.
  await other.locator('.pane.cur .strip').getByTitle('New tab', { exact: true }).click();
  const launcher = (tab) => tab.locator('.tab.active[data-view^="new"]').first();
  await launcher(page).waitFor();
  await launcher(other).locator('.x').click();
  await launcher(page).waitFor({ state: 'detached' });
  check('browser tabs follow tab changes in the same workspace');
  await other.locator('.tab[data-view="global"]').click();
  const otherGlobal = other.locator('.view[data-kind="global"]:visible .note').first();
  await otherGlobal.waitFor();
  check('second app tab receives notes');
  await page.locator('lkjstr-spaces button', { hasText: /^2$/ }).click();
  await page.locator('lkjstr-spaces button.on', { hasText: /^2$/ }).waitFor();
  await launch('Search', 'search');
  const needle = `sharing-probe-${Date.now()}`;
  await page.locator('.view[data-kind="search"] input').first().fill(needle);
  await page.locator('.view[data-kind="search"] input').first().press('Enter');
  for (let n = 0; n < 200 && !fake.searches.includes(needle); n++) await page.waitForTimeout(25);
  check('a fresh want after two tabs reaches the relay', fake.searches.includes(needle));
  check(
    'workspace 2 Search and workspace 1 Global are both visible during the wire probe',
    (await page.locator('.view[data-kind="search"]:visible input').first().isVisible()) &&
      (await otherGlobal.isVisible()) &&
      (await other.locator('lkjstr-spaces button.on', { hasText: /^1$/ }).isVisible()),
  );
  const shared = [...socketProbe.peak.values()].every((peak) => peak === 1);
  const learnedRelays =
    mainPathsSeen.has('/owner') &&
    [...socketProbe.seen].every((path) => path === '/owner' || path === '/');
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
  // Both tabs are ready for the workspace reset even when these observations fail.
  await observe(
    'two app tabs share one socket per relay',
    shared && socketProbe.seen.size > 0,
    page,
  );
  await observe(
    'learned owner relays survive reload and another tab bootstrap',
    learnedRelays,
    page,
  );
  await page.locator('lkjstr-spaces button', { hasText: /^1$/ }).click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('lkjstr:layout:main:spaces'))?.active === 1,
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
