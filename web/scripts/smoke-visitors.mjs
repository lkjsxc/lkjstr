// Existing visitor/key checks shared by the real-engine smoke.
import { randomBytes } from 'node:crypto';
import { openKeyField, seedLayouts } from './smoke-seed.mjs';

const accounts = '.view[data-kind="account"]:visible';
// The npub of a public key nobody here has metadata for (the curve's generator point: nobody's account).
const CH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const polymod = (values) => {
  let c = 1;
  for (const v of values) {
    const top = c >>> 25;
    c = ((c & 0x1ffffff) << 5) ^ v;
    [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3].forEach((g, i) => {
      if ((top >>> i) & 1) c ^= g;
    });
  }
  return c;
};
const bech32 = (hrp, hex) => {
  const data = [];
  let acc = 0;
  let bits = 0;
  for (const byte of hex.match(/../g).map((h) => Number.parseInt(h, 16))) {
    acc = ((acc << 8) | byte) & 0xfff;
    bits += 8;
    while (bits >= 5) data.push((acc >>> (bits -= 5)) & 31);
  }
  if (bits) data.push((acc << (5 - bits)) & 31);
  const codes = [...hrp].map((c) => c.charCodeAt(0));
  const expanded = [...codes.map((c) => c >>> 5), 0, ...codes.map((c) => c & 31)];
  const mod = polymod([...expanded, ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const sum = Array.from({ length: 6 }, (_, i) => (mod >>> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...sum].map((i) => CH[i]).join('')}`;
};
const npub = bech32('npub', '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');

async function installExtension(ctx, relayUrl, pubkey, errors) {
  await ctx.addInitScript(
    ({ relayUrl, pubkey }) => {
      if (location.protocol !== 'http:') return;
      if (!localStorage.getItem(`lkjstr:relays:${pubkey}`))
        localStorage.setItem(
          `lkjstr:relays:${pubkey}`,
          JSON.stringify([{ url: relayUrl, read: true, write: true, search: true }]),
        );
      if (!localStorage.getItem('lkjstr:relays:'))
        localStorage.setItem(
          'lkjstr:relays:',
          JSON.stringify([{ url: relayUrl, read: true, write: true, search: true }]),
        );
      globalThis.nostr = {
        getPublicKey: async () => pubkey,
        signEvent: (event) => globalThis.fixtureSign(event),
      };
    },
    { relayUrl, pubkey: pubkey },
  );
  ctx.on('page', (page) => page.on('pageerror', (error) => errors.push(String(error))));
}

async function visitorChecks({ page, browser, base, relayUrl, errors, shots, shot, check }) {
  /** A fresh visitor in a context of their own: no account, the loopback relay only. */
  const visit = async (options, path = '') => {
    const fresh = await browser.newContext(options);
    await seedLayouts(fresh);
    await fresh.route('**/*', (route) =>
      route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
    );
    await fresh.addInitScript((relayUrl) => {
      if (location.protocol !== 'http:') return;
      localStorage.setItem(
        'lkjstr:relays:',
        JSON.stringify([{ url: relayUrl, read: true, write: true, search: true }]),
      );
    }, relayUrl);
    const p = await fresh.newPage();
    p.on('pageerror', (error) => errors.push(String(error)));
    await p.goto(base + path);
    return p;
  };
  // A first visit, signed out: one tile of readable notes, nothing empty, the way in one press away.
  const firstRun = await page.evaluate(() => ({
    panes: document.querySelectorAll('.pane').length,
    tabs: [...document.querySelectorAll('.tab')].map((t) => t.getAttribute('data-view')),
    empty: [...document.querySelectorAll('.fstate')].map((e) => e.textContent).join(''),
    signIn: document.querySelector('.acct.out')?.textContent,
    oneLine: (document.querySelector('.acct.out')?.getBoundingClientRect().height ?? 99) < 30,
    off: document.querySelectorAll('.act.off').length > 0,
    hex: /[0-9a-f]{64}/.test(document.body.innerText),
  }));
  check(
    'signed-out first run is readable, with no empty tile',
    firstRun.panes === 1 &&
      firstRun.tabs.join() === 'global' &&
      firstRun.empty === '' &&
      firstRun.signIn === 'Sign in' &&
      firstRun.oneLine &&
      firstRun.off &&
      !firstRun.hex,
  );
  // Sign in through the interface: the Accounts tab, the browser extension (the fixture signer).
  await page.locator('.acct.out').click();
  await page.locator(`${accounts} [data-f="extension"]`).waitFor();
  check(
    'sign-in offers the extension and a key field that never echoes; no account is created without a way to its key',
    (await page.locator(`${accounts} input`).getAttribute('type')) === 'password' &&
      (await page.locator(`${accounts} [data-f="create"]`).isVisible()),
  );
  // The same surface on a phone, dark, in Japanese: the bar fits on one line and nothing is clipped.
  const phone = await visit({
    viewport: { width: 390, height: 844 },
    locale: 'ja-JP',
    colorScheme: 'dark',
  });
  await phone.locator('.view[data-kind="global"] .note').first().waitFor();
  await phone.locator('.acct.out').click();
  await phone.locator('.view[data-kind="account"] [data-f="extension"]').waitFor();
  const bar = await phone.evaluate(() => {
    const chips = [...document.querySelectorAll('lkjstr-spaces button')];
    const strip = document.querySelector('lkjstr-spaces').getBoundingClientRect();
    return {
      chips: chips.filter((c) => {
        const b = c.getBoundingClientRect();
        return b.left >= strip.left - 1 && b.right <= strip.right + 1;
      }).length,
      faded: document.querySelector('lkjstr-spaces').className,
      signIn: document.querySelector('.acct.out').getBoundingClientRect().height,
      wide: document.documentElement.scrollWidth - innerWidth,
    };
  });
  check(
    'phone top bar: nine workspaces whole, Sign in on one line',
    bar.chips === 9 && !bar.faded.includes('more') && bar.signIn < 30 && bar.wide <= 0,
  );
  if (shots) {
    await phone.waitForTimeout(300);
    await shot(phone, 'slice-signin-390-dark-ja.png');
  }
  await phone.context().close();
  // A person nobody has metadata for: a short npub for a name, no hex anywhere, no count that is not known.
  const stranger = await visit(
    { viewport: { width: 1440, height: 900 }, locale: 'en-US', colorScheme: 'dark' },
    `/p/${npub}`,
  );
  await stranger.locator('.profile').waitFor();
  await stranger.waitForTimeout(800);
  const pending = await stranger.evaluate(() => ({
    name: document.querySelector('.pname').textContent,
    lines: Math.round(
      document.querySelector('.pname').getBoundingClientRect().height /
        Number.parseFloat(getComputedStyle(document.querySelector('.pname')).lineHeight),
    ),
    tab: document.querySelector('.tab.active > span').textContent,
    stats: document.querySelector('.pstats').textContent,
    hex: /[0-9a-f]{64}/.test(document.body.innerText),
  }));
  check(
    'a profile without metadata shows a short npub and no unknown count',
    /^npub1.{5}…/.test(pending.name) &&
      pending.lines === 1 &&
      pending.tab === pending.name &&
      !pending.stats.includes('+') &&
      !pending.hex,
  );
  if (shots) await shot(stranger, 'slice-profile-pending-1440-dark.png');
  await stranger.context().close();
  const created = await visit({ viewport: { width: 1024, height: 768 }, locale: 'en-US' });
  await created.locator('.acct.out').click();
  await created.locator(`${accounts} [data-f="create"]`).click();
  const keyField = created.locator('.kfield');
  await created.waitForFunction(() => document.querySelector('.kfield')?.value.startsWith('nsec1'));
  const newKey = await keyField.inputValue();
  check(
    'new account opens its masked backup key',
    (await keyField.getAttribute('type')) === 'password',
  );
  await created.locator('.kbox [data-f="show"]').click();
  check(
    'explicit backup can reveal the generated key',
    (await keyField.getAttribute('type')) === 'text',
  );
  check(
    'backup key is absent from interface storage',
    await created.evaluate(
      (key) => !Object.values(localStorage).some((v) => v.includes(key)),
      newKey,
    ),
  );
  await created.locator('.kbox [data-f="done"]').click();
  await created.locator(`${accounts} [data-f="backup"]`).click();
  await created.waitForFunction(() => document.querySelector('.kfield')?.value.startsWith('nsec1'));
  check(
    'Back up key returns the same local secret',
    (await created.locator('.kfield').inputValue()) === newKey,
  );
  await created.locator('.kbox [data-f="done"]').click();
  await created.context().close();
  // A key typed by hand: a throwaway made here, used against the loopback relay only and removed again. It is
  // held in this process and in the engine, and must be nowhere the interface could leave it.
  const throwaway = bech32('nsec', randomBytes(32).toString('hex'));
  const keyed = await visit({ viewport: { width: 1024, height: 768 }, locale: 'en-US' });
  await keyed.locator('.acct.out').click();
  await openKeyField(keyed);
  await keyed.locator(`${accounts} input`).fill(throwaway);
  await keyed.locator(`${accounts} input`).press('Enter');
  await keyed.locator('.acct:not(.out)').waitFor();
  await keyed.locator('.acct').click();
  await keyed.locator('.menu button', { hasText: 'Accounts' }).click();
  await keyed.locator(`${accounts} .arow.on`).waitFor();
  const kept = await keyed.evaluate(
    (k) => ({
      stored: Object.keys(localStorage).some((x) => (localStorage.getItem(x) ?? '').includes(k)),
      shown: document.body.innerText.includes(k) || document.documentElement.outerHTML.includes(k),
      address: location.href.includes(k),
      field: document.querySelector('.view[data-kind="account"] input[type="password"]').value,
      signer: document.querySelector('.arow.on .asigner')?.textContent,
      canPost: document.querySelectorAll('.note .act.off').length === 0,
      backup: document.querySelectorAll('[data-f="backup"]').length,
    }),
    throwaway,
  );
  check(
    'a typed key signs in and is kept nowhere by the interface',
    !kept.stored &&
      !kept.shown &&
      !kept.address &&
      kept.field === '' &&
      kept.signer === 'Key on this device' &&
      kept.canPost &&
      kept.backup === 1,
  );
  await keyed.locator(`${accounts} .arow.on [data-f="remove"]`).click();
  check(
    'removing an account with a key asks first',
    (await keyed.locator(`${accounts} .aask`).count()) === 1 &&
      (await keyed.locator(`${accounts} .arow`).count()) === 1,
  );
  await keyed.locator(`${accounts} .aask [data-f="remove"]`).click();
  await keyed.locator('.acct.out').waitFor();
  await keyed.context().close();
}

export { accounts, installExtension, npub, visitorChecks };
