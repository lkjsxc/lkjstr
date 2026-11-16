// Real Accounts UI round trip on the caller's fresh, loopback-only generated account.
import { openKeyField } from './smoke-seed.mjs';

const accounts = '.view[data-kind="account"]:visible';
const password = 'lkjstr-fixture-session-password';
const backupPassword = 'lkjstr-fixture-backup-password';

async function choose(page, value) {
  await page.locator(`${accounts} .kpassword [data-f="password"]`).fill(value);
  await page.locator(`${accounts} .kpassword [data-f="password-again"]`).fill(value);
  await page.locator(`${accounts} .kpassword [type="submit"]`).click();
}
const unlockField = (page) => page.locator(`${accounts} .kpassword [data-f="password"]`);
async function sendPassword(page, value) {
  await unlockField(page).fill(value);
  await page.locator(`${accounts} .kpassword [type="submit"]`).click();
}
export async function vaultUiChecks(page, check) {
  const original = await page.evaluate(() => localStorage.getItem('lkjstr:account'));
  await page.locator(`${accounts} [data-f="protect"]`).click();
  await choose(page, password);
  await page.locator(`${accounts} .kpassword`).waitFor({ state: 'detached', timeout: 30000 });
  check(
    'explicit Protect commits ciphertext and keeps the account unlocked',
    (await page.locator(`${accounts} .arow.on .asigner`).innerText()) ===
      'Key on this device, password-protected',
  );
  check(
    'protection never stores the typed password in interface state',
    await page.evaluate(
      (value) => !Object.values(localStorage).some((x) => x.includes(value)),
      password,
    ),
  );
  await page.locator(`${accounts} .kbox .krow button`).last().click();
  await page.locator(`${accounts} [data-f="lock"]`).click();
  await page.locator(`${accounts} [data-f="unlock"]`).waitFor();
  check(
    'Lock is reflected in the account row and top-bar mark',
    (await page.locator(`${accounts} .arow.on .asigner`).innerText()) === 'Locked' &&
      (await page.locator('.acct .i-lock').count()) === 1,
  );
  await page.locator(`${accounts} [data-f="backup"]`).click();
  check(
    'locked backup offers Unlock without exporting a key',
    (await page.locator(`${accounts} .kbox input`).count()) === 0 &&
      (await page.locator(`${accounts} .kbox`).innerText()).includes('Unlock this account'),
  );
  await page.locator(`${accounts} .kbox button`).click();
  await sendPassword(page, 'wrong fixture password');
  await page.locator(`${accounts} .kpassword .error`).waitFor({ timeout: 30000 });
  check(
    'wrong unlock password stays inline and returns the keyboard',
    (await page.locator(`${accounts} .kpassword .error`).innerText()).includes('Wrong password.') &&
      (await unlockField(page).evaluate((el) => el === document.activeElement && el.value === '')),
  );
  await sendPassword(page, password);
  await page.locator(`${accounts} .kpassword`).waitFor({ state: 'detached', timeout: 30000 });
  await page.locator(`${accounts} [data-f="backup"]`).click();
  await choose(page, backupPassword);
  const output = page.locator(`${accounts} .kbox .kfield`);
  await output.waitFor({ timeout: 30000 });
  let encrypted = await output.inputValue();
  check(
    'protected backup returns an uncovered ncryptsec and keeps the raw part folded',
    encrypted.startsWith('ncryptsec1') &&
      (await output.getAttribute('type')) === 'text' &&
      (await page.locator(`${accounts} [data-f="show"]`).count()) === 0,
  );
  const incomingDownload = page.waitForEvent('download');
  await page.locator(`${accounts} [data-f="save-encrypted"]`).click();
  const download = await incomingDownload;
  const stream = await download.createReadStream();
  let saved = '';
  if (stream) for await (const chunk of stream) saved += chunk.toString('utf8');
  check(
    'protected copy downloads the exact ciphertext with its npub-based filename',
    saved === encrypted &&
      /^lkjstr-[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{8}\.ncryptsec\.txt$/.test(
        download.suggestedFilename(),
      ),
  );
  saved = '';
  await download.delete();
  await page.locator(`${accounts} [data-f="done"]`).click();
  await page.locator(`${accounts} .arow.on [data-f="remove"]`).click();
  await page.locator(`${accounts} .aask [data-f="remove"]`).click();
  await page.locator('.acct.out').waitFor();
  await page.locator('.acct.out').click();
  await openKeyField(page);
  const signInTab = await page
    .locator(accounts)
    .evaluate((el) => el.closest('.body')?.getAttribute('data-view'));
  await page.locator(`${accounts} [name="lkjstr-key"]`).fill(encrypted);
  await page.locator(`${accounts} [name="lkjstr-key"]`).press('Enter');
  await sendPassword(page, 'wrong fixture password');
  await page.locator(`${accounts} .kpassword .error`).waitFor({ timeout: 30000 });
  check(
    'encrypted import keeps only its password step after a wrong password',
    (await page.locator(`${accounts} .kpassword .error`).innerText()).includes(
      'Wrong password, or',
    ) && (await unlockField(page).inputValue()) === '',
  );
  await sendPassword(page, backupPassword);
  await page.locator('.acct:not(.out)').waitFor({ timeout: 30000 });
  await page.waitForFunction(
    () => !document.querySelector('.view[data-kind="account"]:not([hidden]) .kpassword'),
  );
  check(
    'encrypted import restores the same account',
    (await page.evaluate(() => localStorage.getItem('lkjstr:account'))) === original,
  );
  check(
    'encrypted import removes its guest sign-in tab from the saved visitor layout',
    await (
      await page.waitForFunction((tab) => {
        const guest = JSON.parse(localStorage.getItem('lkjstr:layout:guest') ?? 'null');
        const contains = (node) =>
          node?.type === 'pane'
            ? node.tabs.includes(tab)
            : (node?.children?.some(contains) ?? false);
        return typeof tab === 'string' && guest !== null && !contains(guest);
      }, signInTab)
    ).jsonValue(),
  );
  encrypted = '';
}
