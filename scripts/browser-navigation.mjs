// Navigation/recovery and finite loading, with signed fixtures and no upstreams.
import { spawnSync } from 'node:child_process';
import { fakeRelay } from './browser-relay.mjs';

export async function browserNavigation(browser, url, check) {
  const fixture = spawnSync('cargo', ['run', '-q', '-p', 'lkjstr-protocol', '--example', 'design-fixtures'], { encoding: 'utf8' });
  if (fixture.status !== 0) throw new Error('navigation fixtures failed');
  const data = JSON.parse(fixture.stdout);
  const errors = [];
  async function fresh(fake, viewport = { width: 1440, height: 900 }) {
    const context = await browser.newContext({ viewport, locale: 'en-US' });
    await context.routeWebSocket(/.*/, fake.route);
    await context.route('**/*', (r) => r.request().url().startsWith(url) ? r.continue() : r.abort());
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url);
    await page.locator('.pane').first().waitFor();
    return { context, page };
  }
  const fake = fakeRelay();
  for (const event of data.events) fake.add(event);
  const { context, page } = await fresh(fake);
  const focused = () => page.locator('.pane.focused .body.shown');
  const open = async (name) => {
    await page.locator('.brand').click();
    await page.keyboard.press('Control+k');
    await page.getByRole('dialog').getByRole('button', { name, exact: true }).first().click();
  };
  try {
    await open('Global');
    const source = page.locator('.pane.focused');
    const sourceId = await source.getAttribute('data-pane');
    const root = page.locator(`.pane[data-pane="${sourceId}"] .body.shown .note[data-id="${data.root}"]`).first();
    await root.waitFor();
    const before = await page.locator('.tab').count();
    await root.click({ position: { x: 4, y: 12 } });
    await focused().locator('.thread .note.focused').waitFor();
    check('detail opens in neighbour and preserves source feed', await page.locator(`.pane[data-pane="${sourceId}"] .body.shown .feed`).isVisible());
    check('single click creates italic preview tab', await page.locator('.pane.focused .tab.active.preview').count() === 1);
    await page.locator('.pane.focused .tab:has-text("Notifications")').click();
    await root.click({ position: { x: 4, y: 12 } });
    await focused().locator('.thread .note.focused').waitFor();
    check('clicking the same note reactivates its hidden neighbour preview', await page.locator('.pane.focused .tab.active.preview').count() === 1 && await page.locator('.tab').count() === before + 1);
    await root.locator('.name').click();
    await focused().locator('.profile-head').waitFor();
    check('next detail replaces the neighbour preview', await page.locator('.tab').count() === before + 1);
    await page.keyboard.press('Alt+ArrowLeft');
    await focused().locator('.thread').waitFor();
    check('Alt+Left uses per-tab history', true);
    await page.keyboard.press('Alt+ArrowRight');
    await focused().locator('.profile-head').waitFor();
    check('Alt+Right restores per-tab forward history', true);
    await page.goBack();
    await focused().locator('.thread').waitFor();
    check('browser Back uses focused tab history', true);
    await page.locator('.pane.focused .tab.active').dblclick();
    check('double click keeps preview tab', await page.locator('.pane.focused .tab.active.preview').count() === 0);
    await root.click({ position: { x: 4, y: 12 }, modifiers: ['Control'] });
    await focused().locator('.thread').waitFor();
    check('Ctrl click opens independent kept detail', await page.locator('.tab').count() === before + 2 && await page.locator('.pane.focused .tab.active.preview').count() === 0);
    const count = await page.locator('.pane').count();
    await page.keyboard.press('Alt+Backslash');
    await page.waitForFunction((n) => document.querySelectorAll('.pane').length === n + 1, count);
    await page.keyboard.press('Alt+z');
    await page.waitForFunction((n) => document.querySelectorAll('.pane').length === n, count);
    check('Alt+Z restores layout after split', true);
    await open('Search');
    const search = focused().locator('input[type=search]');
    await search.fill('日本語 history-marker');
    await search.press('Enter');
    await page.waitForFunction(() => decodeURIComponent(location.hash).includes('history-marker'));
    const route = await page.evaluate(() => location.hash);
    const tabs = await page.locator('.tab').count();
    await page.locator('.brand').click();
    await page.keyboard.press('Alt+w');
    await page.keyboard.press('Control+Shift+t');
    await focused().locator('input[type=search]').waitFor();
    check('closed tab reopens with its search state', await focused().locator('input[type=search]').inputValue() === '日本語 history-marker' && await page.locator('.tab').count() === tabs);
    await page.goto(url + route);
    await page.locator('.pane').first().waitFor();
    await focused().locator('input[type=search]').waitFor();
    check('address link restores view and Unicode query', await focused().locator('input[type=search]').inputValue() === '日本語 history-marker');
  } finally { await context.close(); }

  // A silent relay never answers REQ; advance only this fresh browser's clock.
  let silence = true;
  const silent = fakeRelay({ request: () => silence });
  const pending = await fresh(silent);
  try {
    await pending.page.clock.install();
    await pending.page.keyboard.press('Control+k');
    await pending.page.getByRole('dialog').getByRole('button', { name: 'Global', exact: true }).click();
    await pending.page.waitForTimeout(300);
    await pending.page.clock.fastForward(13_000);
    await pending.page.locator('.pane.focused .body.shown .empty').filter({ hasText: 'Could not reach any relay' }).waitFor();
    check('silent feed settles into error and one action', await pending.page.locator('.pane.focused .body.shown .empty button').count() === 1);
    await pending.page.keyboard.press('Control+k');
    await pending.page.getByRole('dialog').getByRole('button', { name: 'Search', exact: true }).first().click();
    await pending.page.locator('.pane.focused .body.shown input[type=search]').fill('silent-query');
    await pending.page.locator('.pane.focused .body.shown input[type=search]').press('Enter');
    await pending.page.waitForTimeout(200);
    await pending.page.clock.fastForward(13_000);
    await pending.page.locator('.pane.focused .body.shown .empty').filter({ hasText: 'Search relays failed' }).waitFor();
    check('silent search settles into error and retry action', await pending.page.locator('.pane.focused .body.shown .empty button').count() === 1);
    await pending.page.goto(url + '#view=' + encodeURIComponent(JSON.stringify({ kind: 'thread', id: 'f'.repeat(64), relays: [] })));
    await pending.page.locator('.pane.focused .body.shown .thread').waitFor();
    await pending.page.waitForTimeout(200);
    await pending.page.clock.fastForward(13_000);
    await pending.page.locator('.pane.focused .body.shown .thread .empty').filter({ hasText: 'Relays failed' }).waitFor();
    check('silent thread settles into error and retry action', await pending.page.locator('.pane.focused .body.shown .thread .empty button').count() === 1);
    silence = false;
    await pending.page.locator('.pane.focused .body.shown .thread .empty').getByRole('button', { name: 'Try again', exact: true }).click();
    await pending.page.locator('.pane.focused .body.shown .thread .empty').filter({ hasText: 'Note not found' }).waitFor();
    check('retry makes a new request and reports counted not-found', /[1-9]\d* relays asked/.test(await pending.page.locator('.pane.focused .body.shown .thread .empty').innerText()));
    await pending.page.goto(url + '#view=' + encodeURIComponent(JSON.stringify({ kind: 'image', url: 'https://blocked.example/photo.png' })));
    await pending.page.locator('.pane.focused .body.shown .image-page .error').waitFor();
    check('failed image has one retry action', await pending.page.locator('.pane.focused .body.shown .image-page button').count() === 1);
  } finally { await pending.context.close(); }
  for (const mode of ['storage', 'signer']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const fake = fakeRelay();
    await context.routeWebSocket(/.*/, fake.route);
    await context.route('**/*', (r) => r.request().url().startsWith(url) ? r.continue() : r.abort());
    await context.addInitScript((mode) => {
      if (mode === 'signer') { window.nostr = { getPublicKey: () => new Promise(() => {}) }; return; }
      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (...args) {
        const request = open.apply(this, args);
        Object.defineProperty(request, 'onsuccess', { configurable: true, get: () => null, set: () => {} });
        return request;
      };
    }, mode);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.clock.install();
    try {
      await page.goto(url);
      if (mode === 'storage') {
        await page.locator('.boot').waitFor();
        await page.clock.fastForward(16_000);
        await page.locator('.pane').first().waitFor();
        await page.locator('.storage-state').filter({ hasText: 'Local storage unavailable' }).waitFor();
        check('blocked storage boot settles into failure and retry', await page.locator('.storage-state button').count() === 1);
      } else {
        await page.locator('.pane').first().waitFor();
        await page.locator('.topbar .account').click();
        await page.getByRole('menuitem', { name: 'Sign in or create a key', exact: true }).click();
        await page.getByRole('button', { name: 'Use signer extension', exact: true }).click();
        await page.clock.fastForward(31_000);
        await page.locator('.pane.focused [role=status]').filter({ hasText: 'The signer did not answer' }).waitFor();
        check('silent signer settles with action available to retry', await page.getByRole('button', { name: 'Use signer extension', exact: true }).isEnabled());
      }
    } finally { await context.close(); }
  }
  check('navigation and deadlines have no page errors' , errors.length === 0);
}
