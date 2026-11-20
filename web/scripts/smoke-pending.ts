// Posting while signing or the relays are slow (the owner, 2026-11-20: rare, but it must not show). A post is pending
// at once and looks the same whether it signs in a moment or seconds later; the field is free throughout; two posts
// in flight keep their own counts; a reload keeps what was not confirmed, truthfully; a refusal keeps its text with
// Retry and Edit; a like stays immediate with its Undo. The mock's `slow` outlier is the fixture.
import type { Page } from 'playwright-core';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (given: Record<string, unknown>) => Promise<Page>;

const COMPOSE = '.view[data-kind="compose"]';
const HOME = '.view[data-kind="home"]';
/** The first Home entries: kind, time slot, height, top, text. */
const top = (page: Page) =>
  page.locator(`${HOME} article`).evaluateAll((els) =>
    els.slice(0, 3).map((e) => {
      const r = e.getBoundingClientRect();
      return {
        draft: e.classList.contains('home-draft'),
        pending: e.classList.contains('pending'),
        time: e.querySelector('time')?.textContent ?? '',
        h: Math.round(r.height),
        y: Math.round(r.top),
        text: e.querySelector('.text')?.textContent?.trim() ?? '',
      };
    }),
  );
const says = async (page: Page, sel: string): Promise<string> =>
  (await page.locator(sel).innerText()).toLowerCase();

export async function pendingChecks(open: Open, check: Check): Promise<void> {
  const page = await open({
    fresh: true,
    mock: { live: false, slow: { when: 'outlier', sign: 4000, relays: 3000 } },
  });
  const field = page.locator(`${COMPOSE} textarea`);
  const post = async (text: string): Promise<void> => {
    await field.fill(text);
    await field.press('Control+Enter');
  };
  await post('An ordinary note before');
  await page.waitForTimeout(200);
  await post('The rare outlier, slow to sign and to deliver');
  check(
    'pending: the field is free and keeps the caret the moment Post is pressed',
    (await field.inputValue()) === '' &&
      (await field.evaluate((el) => el === document.activeElement)),
  );
  await post('An ordinary note after, posted meanwhile');
  await page.waitForTimeout(800);
  const signing = await top(page);
  const [slow, after] = signing;
  check(
    'pending: the unsigned outlier shows the same Sending mark and height as a signed note',
    Boolean(slow?.draft && after && !after.draft) &&
      slow?.time === 'sending…' &&
      Math.abs((slow?.h ?? 0) - (after?.h ?? 0)) <= 1,
    signing,
  );
  check(
    'pending: nothing says signing, in Home or in the composer',
    !(await says(page, HOME)).includes('signing') &&
      !(await says(page, COMPOSE)).includes('signing'),
  );
  // Like a note while the outlier is still out: drawn at once, with its Undo, as always.
  const liked = await page
    .locator(`${HOME} .note:not(.home-draft) .act.a-heart`)
    .evaluateAll((els) => els.findIndex((el) => !el.classList.contains('on')));
  const heart = page.locator(`${HOME} .note:not(.home-draft) .act.a-heart`).nth(liked);
  await heart.click();
  check(
    'pending: a like stays immediate with its Undo while a post is slow',
    (await heart.evaluate((el) => el.classList.contains('on'))) &&
      (await page.locator('.toast.undo').count()) > 0,
  );
  await page.locator('.toast.undo .lnk').last().click();
  check(
    'pending: Undo takes the like back',
    !(await heart.evaluate((el) => el.classList.contains('on'))),
  );
  // Signed: the verified note takes the draft's place without moving it; still sending while the relays are slow.
  await page.waitForSelector(`${HOME} .home-draft`, { state: 'detached', timeout: 8000 });
  const signed = (await top(page))[0];
  check(
    'pending: once signed, the outlier stays where it was, still sending',
    signed?.text === slow?.text &&
      signed?.time === 'sending…' &&
      Math.abs((signed?.y ?? 0) - (slow?.y ?? 0)) <= 1 &&
      Math.abs((signed?.h ?? 0) - (slow?.h ?? 0)) <= 1,
    [slow, signed],
  );
  const outbox = await page.locator(`${COMPOSE} .outbox`).innerText();
  check(
    'pending: two posts in flight each keep their own count',
    outbox.includes('The rare outlier') &&
      !outbox.includes('An ordinary note after') &&
      /Sending… 0 of 4 relays have it/.test(outbox),
    outbox,
  );
  await page.waitForFunction(
    (sel) => !document.querySelector(sel)?.textContent?.includes('The rare outlier'),
    `${COMPOSE} .outbox`,
    { timeout: 8000 },
  );
  check(
    'pending: confirmed, the outlier reads as an ordinary note',
    (await top(page))[0]?.time !== 'sending…',
  );

  // A reload while a post is unsigned and the next is being typed: both are there, and Retry sends it.
  await post('Another outlier, closed before it was signed');
  await field.fill('the next note, half typed');
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('.note');
  const kept = await page.locator(`${COMPOSE} .outbox`).innerText();
  check(
    'pending: after a reload the unsent post waits with Retry, and the field keeps its text',
    kept.includes('Another outlier') &&
      kept.includes('Saved message; retry to send.') &&
      (await field.inputValue()) === 'the next note, half typed',
    kept,
  );
  await page.locator(COMPOSE).getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(
    (sel) => !document.querySelector(sel)?.textContent?.includes('Another outlier'),
    `${COMPOSE} .outbox`,
    { timeout: 15000 },
  );
  check(
    'pending: the retried post goes out',
    (await field.inputValue()) === 'the next note, half typed',
  );

  // Refused by the relays: the text stays with Retry, Edit and Remove; Edit keeps what is being typed.
  await field.fill('free airdrop');
  await field.press('Control+Enter');
  await field.fill('kept while editing the refused one');
  await page.locator(`${COMPOSE} .outbox .error`).waitFor();
  check(
    'pending: a refused post says why and keeps its text',
    (await page.locator(`${COMPOSE} .outbox`).innerText()).includes('free airdrop') &&
      (await page.locator(`${COMPOSE} .outbox .error`).innerText()).includes('Refused'),
  );
  await page.locator(COMPOSE).getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('.menu button').first().click();
  check(
    'pending: Edit with text in the field keeps both drafts',
    (await field.inputValue()) === 'free airdrop' &&
      (await page.locator(`${COMPOSE} .outbox`).innerText()).includes(
        'kept while editing the refused one',
      ),
  );
  await page.context().close();
}
