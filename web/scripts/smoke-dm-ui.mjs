// Visible M controls with fresh local accounts; the raw wire is only fixture setup.

import { dmUiLock } from './smoke-dm-lock.mjs';
import { act } from './smoke-dm-wire.mjs';

const privateIncoming = 'Loopback private incoming marker';
const privateOutgoing = 'Loopback private outgoing marker';
const privateDraft = 'Loopback private unsent archive marker';
export const privateMarkers = [
  privateIncoming,
  privateOutgoing,
  privateDraft,
  'Loopback private cross-page tail',
];
const pass = 'private UI fixture password';
const conversation = '.view[data-kind="message"]:visible';
async function must(page, action) {
  const result = await act(page, action);
  if (!result.ok) throw new Error(`fixture setup ${action.a}: ${result.error?.code}`);
  return result;
}
export async function dmUiScenario({ page, relayUrl, fake, hold, release, check }) {
  await page.locator('.acct.out').click();
  await page.locator('.view[data-kind="account"]:visible [data-f="create"]').click();
  await page.locator('.kbox .kpassword').waitFor();
  await page.locator('.kbox [data-f="done"]').click();
  const owner = await page.evaluate(() => window.dmUi.accounts.active);
  await page.keyboard.press('Alt+Shift+M');
  await page.locator('.view[data-kind="messages"]:visible .dm-setup button').waitFor();
  await page.evaluate(() => {
    const sub = window.dmUi.events
      .filter((m) => m.direction === 'in' && m.t === 'dm.open' && !m.query?.unreadOnly)
      .at(-1)?.sub;
    const settled = window.dmUi.events
      .filter(
        (m) =>
          m.direction === 'out' &&
          m.t === 'dm' &&
          m.sub === sub &&
          m.phase === 'unsupported' &&
          m.error === 'not-found',
      )
      .at(-1);
    window.dmUi.inboxProbe = {
      sub,
      snapshots: [{ phase: settled?.phase, error: settled?.error, at: performance.now() }],
    };
  });
  // Observe several real one-second scheduler rotations; this is not a longer success timeout.
  await page.waitForTimeout(3500);
  check(
    'known empty inbox remains settled across scheduler rotations',
    await page.evaluate(
      () =>
        !!window.dmUi.inboxProbe?.sub &&
        window.dmUi.inboxProbe.snapshots.every(
          (s) => s.phase === 'unsupported' && s.error === 'not-found',
        ),
    ),
  );
  await page.locator('.view[data-kind="messages"]:visible .dm-setup button').click();
  const settings = page.locator('.view[data-kind="settings"]:visible');
  await settings.locator('.ssearch input').fill('dmRelays');
  const entry = settings.locator('[data-entry="dmRelays"]');
  if (!(await entry.locator('.srow').count())) {
    await entry.locator('input').fill(relayUrl);
    await entry.locator('form button').click();
  }
  check(
    'inbox edits do not publish before explicit Save',
    !fake.published.some((e) => e.kind === 10050),
  );
  await entry.locator('.actions .btn').click();
  await page.waitForFunction(
    () =>
      window.dmUi.accounts.accounts.find((a) => a.author.pubkey === window.dmUi.accounts.active)
        ?.inbox?.length === 1,
  );
  check(
    'explicit inbox Save publishes one verified own list',
    fake.published.filter((e) => e.kind === 10050 && e.pubkey === owner).length === 1,
  );
  await must(page, { a: 'account.add', how: 'create' });
  const peer = await page.evaluate(() => window.dmUi.accounts.active);
  await must(page, {
    a: 'profile.save',
    as: peer,
    profile: { name: 'Private fixture peer', about: '' },
  });
  await must(page, { a: 'dm.relays.save', as: peer, relays: [relayUrl] });
  await must(page, { a: 'account.use', pubkey: owner });
  await must(page, {
    a: 'dm.send',
    as: peer,
    draft: { recipients: [owner], text: privateIncoming },
  });
  // Use only this context's generated test key, and never return it to the Node report.
  const protectedOkay = await page.evaluate(
    async ({ owner, pass }) => {
      const backup = await window.dmUiAct({
        a: 'account.exportEncrypted',
        pubkey: owner,
        password: pass,
        logN: 16,
      });
      if (!backup.ok || !backup.encryptedKey) return false;
      const restored = await window.dmUiAct({
        a: 'account.importEncrypted',
        key: backup.encryptedKey,
        password: pass,
      });
      backup.encryptedKey = undefined;
      return restored.ok;
    },
    { owner, pass },
  );
  check('private UI fixture uses an explicitly protected fresh key', protectedOkay);
  await page.keyboard.press('Alt+Shift+M');
  const messages = page.locator('.view[data-kind="messages"]:visible');
  await messages.locator('.list .chan').filter({ hasText: privateIncoming }).click();
  const view = page.locator(conversation),
    area = view.locator('textarea');
  await view.locator('.dm-row').filter({ hasText: privateIncoming }).waitFor();
  await area.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const el = document.querySelector('.view[data-kind="message"]:not([hidden]) textarea');
    return el && !el.disabled;
  });
  const originalTab = await view.evaluate((el) => el.closest('.body').dataset.view);
  check('the real list opens its authenticated conversation', true);
  hold();
  const firstWrap = fake.published.filter((e) => e.kind === 1059).length;
  await area.fill(privateOutgoing);
  await view.locator('.cbar .btn').click();
  await view.locator('.dm-outbox-row.pending').waitFor();
  check(
    'Send clears and refocuses the input while a real publication is pending',
    (await area.inputValue()) === '' &&
      (await area.evaluate((el) => document.activeElement === el)),
  );
  release();
  await view.locator('.dm-row').filter({ hasText: privateOutgoing }).waitFor();
  await view.locator('.dm-outbox-row').waitFor({ state: 'detached' });
  const wraps = fake.published.filter((e) => e.kind === 1059).slice(firstWrap);
  check(
    'Send produces recipient and sender wrappers with no public plaintext',
    wraps.length === 2 &&
      wraps.every((e) => !e.content.includes(privateOutgoing)) &&
      !fake.published.some((e) => [4, 13, 14].includes(e.kind)),
  );
  const beforeSave = await page.evaluate(() => window.dmUi.saves);
  await area.fill(privateDraft);
  await page.waitForFunction((before) => window.dmUi.saves > before, beforeSave);
  check('a real encrypted archive acknowledges the current private input', true);
  check(
    'private bodies never enter browser preference storage',
    await page.evaluate(
      (texts) =>
        !Object.values(localStorage).some((value) => texts.some((text) => value.includes(text))),
      [privateIncoming, privateOutgoing, privateDraft],
    ),
  );
  const publishedBeforeReload = fake.published.filter((e) => e.kind === 1059).length;
  await page.reload();
  await page.waitForFunction(() => !!window.dmUi?.accounts);
  const locked = await page.evaluate(
    (owner) => window.dmUi.accounts.accounts.find((a) => a.author.pubkey === owner)?.locked,
    owner,
  );
  if (locked) {
    await page.locator(`${conversation} button`).filter({ hasText: 'Unlock' }).click();
    const accounts = page.locator('.view[data-kind="account"]:visible');
    await accounts.locator('.kpassword [data-f="password"]').fill(pass);
    await accounts.locator('.kpassword [type="submit"]').click();
    await accounts.locator('.kpassword').waitFor({ state: 'detached' });
    await page.locator(`.tab[data-view="${originalTab}"]`).click();
  }
  await page.waitForFunction(
    (text) =>
      [...document.querySelectorAll('.view[data-kind="message"] textarea')].some(
        (el) => !el.disabled && el.value === text,
      ),
    privateDraft,
  );
  check(
    'reload restores the original private draft without an automatic resend',
    fake.published.filter((e) => e.kind === 1059).length === publishedBeforeReload,
  );
  await dmUiLock({ page, owner, pass, originalTab, check });
}
