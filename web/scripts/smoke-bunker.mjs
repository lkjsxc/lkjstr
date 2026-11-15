// Real NIP-46 accounts with a loopback encrypted bunker.
import { accounts, code, compose, launch, setup } from './smoke-signer-support.mjs';

async function post(page, text) {
  await page.locator(`${compose} textarea`).fill(text);
  await page.locator(compose).getByRole('button', { name: 'Post', exact: true }).click();
}
async function remote(options, secret) {
  const { bunker, check, fake, relayUrl } = options;
  const page = await setup({ ...options, mode: 'remote' });
  const path = secret ? '/bunker-secret' : '/bunker';
  const url = `bunker://${bunker.pubkey}?relay=${encodeURIComponent(relayUrl + path)}`;
  try {
    await page.locator('.acct.out').click();
    if (secret) {
      await page.locator(`${accounts} input`).fill(url);
      await page.locator(`${accounts} input`).press('Enter');
      await code(page, 'signer-refused');
      check(
        'NIP-46 secret-required bunker refuses missing secret',
        (await page.locator('.acct.out').count()) === 1,
      );
    }
    await page
      .locator(`${accounts} input`)
      .fill(url + (secret ? '&secret=fixture-authorization' : ''));
    await page.locator(`${accounts} input`).press('Enter');
    await page.locator('.acct:not(.out)').waitFor();
    const connects = bunker.calls.filter((c) => c.method === 'connect' && c.authorized).length;
    check(`NIP-46 connects ${secret ? 'with' : 'without'} secret`);
    await launch(page, 'Write', 'compose');
    const text = `bunker ${secret} before reload`;
    await post(page, text);
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.cresult')].some((e) => e.textContent.includes('Delivered')),
    );
    check(
      `NIP-46 signs ${secret ? 'with' : 'without'} secret`,
      fake.published.some((e) => e.pubkey === bunker.pubkey && e.content === text),
    );
    const client = bunker.calls.at(-1).client;
    await page.reload();
    await page.locator('.acct:not(.out)').waitFor();
    await page.locator(`${compose} textarea`).waitFor();
    const reloaded = `bunker ${secret} after reload`;
    await post(page, reloaded);
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.cresult')].some((e) => e.textContent.includes('Delivered')),
    );
    check(
      `NIP-46 reload reuses authorized credentials ${secret}`,
      fake.published.some((e) => e.pubkey === bunker.pubkey && e.content === reloaded) &&
        bunker.calls.at(-1).client === client &&
        bunker.calls.filter((c) => c.method === 'connect' && c.authorized).length === connects &&
        (await page.evaluate(
          () => window.signerCalls.getPublicKey === 0 && window.signerCalls.signEvent === 0,
        )),
    );
    bunker.refuse(true);
    await page.evaluate(() => {
      window.signerResults = [];
    });
    const refused = `keep refused bunker draft ${secret}`;
    await post(page, refused);
    await code(page, 'signer-refused');
    check(
      `NIP-46 refusal preserves draft ${secret}`,
      (await page.locator(`${compose} textarea`).inputValue()) === refused &&
        !fake.published.some((e) => e.content === refused),
    );
    bunker.refuse(false);
    await page.evaluate(() => {
      window.signerResults = [];
    });
    bunker.hold(true);
    const before = fake.published.length;
    await post(page, 'keep bunker outage draft');
    for (let n = 0; n < 100 && !bunker.waiting(); n++) await page.waitForTimeout(20);
    check(`NIP-46 signs in flight before outage ${secret}`, bunker.waiting() > 0);
    bunker.down();
    bunker.hold(false);
    await launch(page, 'Search', 'search');
    await page
      .locator('.pane.cur .view[data-kind="search"] input')
      .first()
      .fill('bunker unavailable');
    await code(page, 'signer-missing');
    check(`NIP-46 outage reports signer-missing ${secret}`, fake.published.length === before);
    await page.locator('.pane.cur .tab[data-view^="compose"]').last().click();
    check(
      `NIP-46 outage preserves draft ${secret}`,
      (await page.locator(`${compose} textarea`).inputValue()) === 'keep bunker outage draft',
    );
    bunker.up();
    await post(page, 'keep bunker outage draft');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.cresult')].some((e) => e.textContent.includes('Delivered')),
    );
    check(
      `NIP-46 recovers without new authorization ${secret}`,
      fake.published.some((e) => e.content === 'keep bunker outage draft'),
    );
    await page.locator('.acct').click();
    await page.locator('.menu button', { hasText: 'Accounts' }).click();
    await page.locator(`${accounts} .arow [data-f="remove"]`).click();
    await page.locator(`${accounts} .aask [data-f="remove"]`).click();
    await page.locator('.acct.out').waitFor();
    await page.reload();
    await page.locator('.acct.out').waitFor();
    check(`NIP-46 removal survives reload ${secret}`);
    check(
      `NIP-46 credentials absent from interface storage ${secret}`,
      await page.evaluate(
        () =>
          !Object.values(localStorage).some((v) =>
            /client_secret|fixture-authorization|bunker:\/\//.test(v),
          ),
      ),
    );
  } finally {
    bunker.up();
    bunker.refuse(false);
    bunker.hold(false);
    await page.context().close();
  }
}

export { remote };
