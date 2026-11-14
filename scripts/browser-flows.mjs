// Account, profile, notification and search checks against public-only fixtures.
import { fixtures } from './browser-relay.mjs';

export async function browserFlows(page, fake, check, shot) {
  const root = fake.published.find((e) => e.kind === 1);
  const data = await fixtures(root);
  check('posted event id and Schnorr signature verify', data.verified);
  fake.setRemote(data.remote);
  for (const event of data.events) fake.add(event);

  await page.click('.tab:has-text("Notifications")');
  await page.locator('.body.shown .note:has-text("Fixture reply notification")').waitFor();
  await page.locator('.body.shown .note.compact:has-text("liked")').waitFor();
  check('notifications render a verified reply and reaction from another author', true);
  await shot('06-notifications');
  await page.locator('.body.shown .note:has-text("Fixture reply notification") .name').click();
  await page.locator('.body.shown .profile-head h2:has-text("Smoke Person")').waitFor();
  await page.locator('.body.shown .profile-head .about:has-text("Local fake relay profile")').waitFor();
  await page.locator('.body.shown .profile-page .note:has-text("Fixture reply notification")').waitFor();
  check('profile loads signed metadata and author notes', true);
  await shot('07-profile');

  async function search(text) {
    // The global shortcut is ignored inside text fields.
    await page.locator('.topbar .brand').click();
    await page.keyboard.press('/');
    const input = page.locator('.pane.focused .body.shown input[type=search]');
    await input.fill(text);
    await input.press('Enter');
  }
  await search('lkjstr smoke test');
  await page.locator('.pane.focused .body.shown .search .note:has-text("Hello from the lkjstr smoke test")').waitFor();
  check('text search finds a cached note', true);
  await search('remote-only-needle');
  await page.locator('.pane.focused .body.shown .search .note:has-text("remote-only-needle")').waitFor();
  check('NIP-50 search fetches a note absent from the cache', fake.searches.includes('remote-only-needle'));
  await search('no-match-for-this-query');
  await page.locator('.pane.focused .body.shown .search >> text=No matches on this device or the relays we asked.').waitFor({ timeout: 10000 });
  check('empty search settles after relay EOSE', true);
  await shot('08-search-empty');
  await search('refused-search-query');
  await page.locator('.pane.focused .body.shown .search >> text=Search relays failed or refused this request. Cached notes were searched.').waitFor();
  check('search relay refusals report failure', true);
  for (const code of [data.npub, data.nprofile]) {
    await search(code);
    await page.locator('.pane.focused .body.shown button:has-text("Open profile")').click();
    await page.locator('.pane.focused .body.shown .profile-head h2:has-text("Smoke Person")').waitFor();
  }
  check('npub and nprofile search links open the profile', true);
  for (const code of [data.note, `nostr:${data.nevent}`]) {
    await search(code);
    await page.locator('.pane.focused .body.shown button:has-text("Open note")').click();
    await page.locator('.pane.focused .body.shown .thread .note.focused:has-text("Hello from the lkjstr smoke test")').waitFor();
  }
  check('note and nevent search links open the focused thread', true);

  await page.click('.topbar .account');
  const key = page.getByRole('textbox', { name: 'Key to import' });
  await key.fill('invalid-input');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.locator('.accounts').locator('..').getByRole('status').filter({ hasText: 'Paste an nsec1' }).waitFor();
  check('invalid account import reports a real failure', (await page.locator('.accounts li').count()) === 1);
  await key.fill(data.npub);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.locator('.accounts li.active:has-text("read only")').waitFor();
  check('npub import selects a read-only account', (await page.locator('.accounts li').count()) === 2);
  await page.click('.tab:has-text("Home")');
  await page.locator('.pane.focused .body.shown .note:has-text("Fixture reply notification")').waitFor();
  check('switching accounts removes the old Home rows', (await page.locator('.pane.focused .body.shown .feed > .note:has-text("Hello from the lkjstr smoke test")').count()) === 0);
  await page.click('.tab:has-text("Notifications")');
  await page.locator('.pane.focused .body.shown >> text=No replies, mentions or reactions yet.').waitFor();
  check('switching accounts clears the old notifications', true);
  await page.locator('.topbar .brand').click();
  await page.keyboard.press('n');
  const compose = page.locator('.pane.focused .body.shown .compose');
  await compose.locator('textarea').fill('read-only attempt');
  check('read-only compose disables signing', await compose.getByRole('button', { name: 'Post', exact: true }).isDisabled());
  const before = fake.published.length;
  await compose.locator('textarea').press('Control+Enter');
  await compose.getByRole('alert').filter({ hasText: 'This account cannot sign.' }).waitFor();
  check('read-only keyboard posting reports failure without publishing', fake.published.length === before);
  await page.click('.topbar .account');
  await page.locator('.accounts li:has-text("key on this device") button:has-text("Use")').click();
  await page.locator('.accounts li.active:has-text("key on this device")').waitFor();
  await page.locator('.accounts li:has-text("read only") button:has-text("Remove")').click();
  check('switch and remove keep the local signing account', (await page.locator('.accounts li').count()) === 1);
  await page.locator('.topbar .brand').click();
  await page.keyboard.press('n');
  await page.locator('.pane.focused .body.shown textarea').fill('Signing still works after reload and account switch');
  await page.locator('.pane.focused .body.shown textarea').press('Control+Enter');
  await page.locator('.pane.focused .body.shown .publishes >> text=/accepted by \\d+ of/').first().waitFor();
  const verified = await fixtures(root, fake.published);
  check('all browser posts, replies and reactions have valid ids and signatures', verified.verified);
}
