import { front, slowly, view } from './smoke-wish-support.mjs';
export async function wishFields({ page, width, real, relayUrl, events, fact }) {
  const arrival = real
    ? () => events({ kind: 'arrival', width })
    : async () => {
        await page.evaluate(() => {
          const account = window.wish.messages.findLast((m) => m.t === 'accounts')?.active;
          if (account)
            window.wish.send({
              t: 'act',
              req: `wish-arrival-${Date.now()}`,
              action: {
                a: 'publish',
                as: account,
                what: { k: 'note', draft: { text: `Engine wish field arrival ${Date.now()}` } },
              },
            });
        });
      };
  if (width === 1440) {
    await page.locator(`${view('global')} .rtoggle`).click();
    const period = page.locator(`${view('global')} .pdays input`).first();
    await slowly(page, period, '2000/01/01', fact, '2 period', arrival);
    await period.press('Enter');
    fact(
      '2 complete period applies without rewriting slashes',
      (await period.inputValue()) === '2000/01/01',
    );
    await page.locator(`${view('global')} .rclear`).click();
    await slowly(
      page,
      page.locator(`${view('global')} .rbar input`),
      'eng',
      fact,
      '2 query',
      arrival,
    );
    await page.locator(`${view('global')} .rclear`).click();
    await page.locator(`${view('global')} .rtoggle`).click();
    await slowly(page, page.locator(`${view('global')} .padd`), 'ao', fact, '2 people', arrival);
    await page.locator(`${view('global')} .rclear`).click();
    await front(page, 'settings');
    await slowly(
      page,
      page.getByLabel('Search settings', { exact: true }),
      'relay',
      fact,
      '2 settings search',
      arrival,
    );
    const relay = page.locator('[data-entry="set.relayList"]').getByLabel('Relay address', {
      exact: true,
    });
    const relayDraft = real ? 'ws://127.0.0.1:12345/wish' : 'wss://relay.test';
    await slowly(page, relay, relayDraft, fact, '2 relay address', arrival);
    // Blurring saves the address. Keep the actual edit on the owned fixture relay.
    if (real) await relay.fill(`${relayUrl}/wish`);
    await page.getByLabel('Search settings', { exact: true }).fill('server');
    await slowly(
      page,
      page.getByLabel('Media server address', { exact: true }),
      'https://media.test',
      fact,
      '2 server address',
      arrival,
    );
  }
}
