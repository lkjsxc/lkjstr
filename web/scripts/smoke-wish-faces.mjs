import { front, view } from './smoke-wish-support.mjs';
export async function wishFaces({ page, real, events, width, fact }) {
  if (real) {
    const face = await page.locator('.acct [data-face]').elementHandle();
    const picture = await events({ kind: 'face', width });
    const key = await page.locator('.acct [data-face]').getAttribute('data-face');
    // Learn the externally changed metadata through an explicit profile request;
    // automatic profile refresh priority belongs to the orchestration job.
    await page.evaluate((key) => {
      window.wish.send({
        t: 'open',
        sub: 'wish-face-refresh',
        query: { source: 'people', authors: [key] },
      });
      window.wish.send({
        t: 'window',
        sub: 'wish-face-refresh',
        anchor: 'top',
        before: 0,
        after: 1,
      });
    }, key);
    await page.waitForFunction(
      (picture) => document.querySelector('.acct img')?.getAttribute('src') === picture,
      picture,
    );
    await page.evaluate(() => window.wish.send({ t: 'close', sub: 'wish-face-refresh' }));
    fact(
      '7 newer kind 0 updates the existing account face',
      await face.evaluate((el) => el.isConnected),
    );
    await front(page, 'account');
    fact(
      '7 Accounts draws the same face',
      (await page.locator(`${view('account')} .arow.on .av img`).getAttribute('src')) === picture,
    );
    await page.locator('.acct').click();
    fact(
      '7 account menu draws the same face',
      (await page.locator('.menu img').first().getAttribute('src')) === picture,
    );
    await page.keyboard.press('Escape');
    await front(page, 'compose');
    await page.reload();
    await page.waitForFunction(
      (picture) => document.querySelector('.acct img')?.getAttribute('src') === picture,
      picture,
    );
    fact(
      '7 remembered face survives reload and posting face agrees',
      (await page.locator(`${view('compose')} .cwho img`).getAttribute('src')) === picture,
    );
  }
}
