// A real editor's queued encrypted write must be flushed by Lock from a second browser page.
export async function dmUiLock({ page, owner, pass, originalTab, check }) {
  const peer = await page.context().newPage();
  const tail = 'Loopback private cross-page tail';
  try {
    await peer.goto(page.url());
    await peer.waitForFunction(() => window.dmUi?.accounts && window.dmUi.editors > 0);
    await peer.locator('.acct').click();
    await peer.locator('.menu button').getByText('Accounts', { exact: true }).click();
    const accounts = peer.locator('.view[data-kind="account"]:visible');
    await accounts.locator('.arow.on [data-f="lock"]').waitFor();
    await page.evaluate(() => {
      window.dmUi.holdSaves = true;
    });
    await page.locator('.view[data-kind="message"]:visible textarea').fill(tail);
    await page.waitForFunction(() => window.dmUi.heldWrites === 1);
    check('the cross-page Lock starts with a real unsaved editor write', true);
    await accounts.locator('.arow.on [data-f="lock"]').click();
    await accounts.locator('.arow.on [data-f="unlock"]').waitFor();
    await page.waitForFunction(
      (pubkey) => window.dmUi.accounts.accounts.find((a) => a.author.pubkey === pubkey)?.locked,
      owner,
    );
    check(
      'Lock prepares the other page and waits for its actual archive write',
      await page.evaluate(
        () =>
          window.dmUi.flushes.some((m) => m.phase === 'prepare') &&
          window.dmUi.heldWrites === 0 &&
          !document.querySelector('.view[data-kind="message"] textarea'),
      ),
    );
    await accounts.locator('.arow.on [data-f="unlock"]').click();
    await accounts.locator('.kpassword [data-f="password"]').fill(pass);
    await accounts.locator('.kpassword [type="submit"]').click();
    await accounts.locator('.kpassword').waitFor({ state: 'detached' });
    await page.locator(`.tab[data-view="${originalTab}"]`).click();
    await page.waitForFunction(
      (text) =>
        [...document.querySelectorAll('.view[data-kind="message"] textarea')].some(
          (el) => !el.disabled && el.value === text,
        ),
      tail,
    );
    check('unlock restores the other page’s exact unsaved tail from the encrypted archive', true);
  } finally {
    await peer.close();
  }
}
