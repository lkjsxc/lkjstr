// @mentions in every composer (owner, 2026-11-21): a bare @ opens a person picker over the people the reader follows
// and the thread's people, a name narrows it, the keyboard or a tap chooses, the choice shows as a chip under the
// field, and the published note shows a link that opens that person. The Post tab, the field under a thread's focus
// and Quote, on a desktop with the keyboard and on a phone by touch.
import type { Locator, Page } from 'playwright-core';
import { byHandle } from '../src/engine/mock/people.ts';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (
  path: string,
  given: Record<string, unknown>,
  size?: { width: number; height: number },
  touch?: boolean,
) => Promise<Page>;

const MENU = '.mention-menu:not([hidden])';
const OPTION = `${MENU} [role="option"]`;
const HOME = '.view[data-kind="home"]:visible';
const COMPOSE = '.view[data-kind="compose"]:visible';
const THREAD = '.view[data-kind="thread"]:visible';
const PROFILE = '.view[data-kind="profile"]:visible';
const replyable = '.note:has(> .nrow > .nmain > .acts > .a-reply:not(.off))';
/** A follow of the mock reader whose name starts with these letters, and only one does. */
const NEEDLE = 'len';
const NAME = 'Lena Fischer';

/** Whether the open menu lies wholly inside the viewport and its tile, so no choice is cut off. */
const inside = (page: Page): Promise<boolean> =>
  page.locator(MENU).evaluate((menu) => {
    const m = menu.getBoundingClientRect();
    const v = menu.closest('.view')?.getBoundingClientRect();
    const port = visualViewport ?? { width: innerWidth, height: innerHeight };
    const within = (r: { top: number; bottom: number; left: number; right: number }) =>
      m.top >= r.top - 1 &&
      m.bottom <= r.bottom + 1 &&
      m.left >= r.left - 1 &&
      m.right <= r.right + 1;
    const first = menu.querySelector('[role="option"]')?.getBoundingClientRect();
    return (
      !!v &&
      within(v) &&
      within({ top: 0, left: 0, bottom: port.height, right: port.width }) &&
      !!first &&
      first.height >= 40 &&
      document
        .elementFromPoint(first.left + first.width / 2, first.top + first.height / 2)
        ?.closest('.mention-menu') === menu
    );
  });

/** Types a bare @, then a name, chooses that person, and checks the field and its chip. */
async function choose(
  page: Page,
  fact: Check,
  route: string,
  field: Locator,
  touch: boolean,
): Promise<void> {
  if (touch) await field.tap();
  else await field.focus();
  await field.press('End');
  await field.pressSequentially(' @', { delay: 30 });
  await page.locator(OPTION).first().waitFor();
  const bare = await page.locator(OPTION).allInnerTexts();
  fact(
    `${route}: a bare @ opens the picker with people to choose`,
    bare.length >= 1 && bare.length <= 6,
    bare,
  );
  fact(`${route}: the open picker is whole and on top`, await inside(page));
  await field.pressSequentially(NEEDLE, { delay: 30 });
  await page.waitForFunction(
    ([sel, name]) => document.querySelector(sel)?.textContent?.includes(name) === true,
    [OPTION, NAME] as const,
  );
  if (touch) await page.locator(OPTION, { hasText: NAME }).first().tap();
  else {
    // Down and up again come back to the first choice; Enter takes it.
    await field.press('ArrowDown');
    await field.press('ArrowUp');
    await field.press('Enter');
  }
  const value = await field.inputValue();
  fact(
    `${route}: choosing puts the name in the text, a space after it, and keeps the keyboard`,
    value.endsWith(`@${NAME} `) &&
      (await page.locator(MENU).count()) === 0 &&
      (await field.evaluate((el) => el === document.activeElement)),
    value,
  );
  const chip = field
    .locator('xpath=ancestor::*[contains(@class,"compose")][1]')
    .locator('.mention-preview');
  fact(
    `${route}: the chosen person shows as a chip under the field`,
    (await chip.locator('.mchip', { hasText: NAME }).count()) === 1,
    await chip.innerText().catch(() => ''),
  );
}

/** Finds the published note's mention link in `where`, presses it, and checks it opens that person. */
async function opens(
  page: Page,
  fact: Check,
  route: string,
  where: string,
  text: string,
  touch: boolean,
) {
  const note = page.locator(`${where} .note`, { hasText: text }).first();
  await note.waitFor();
  const link = note.locator('.content > .text .lnk', { hasText: `@${NAME}` }).first();
  fact(
    `${route}: the published note shows the mention as a link`,
    (await link.count()) === 1,
    await note.locator('.content > .text').first().innerText(),
  );
  if (!(await link.count())) return;
  if (touch) await link.tap();
  else await link.click();
  const head = page.locator(`${PROFILE} .profile`).first();
  await head.waitFor();
  fact(`${route}: the link opens that person`, (await head.innerText()).includes(NAME));
}

export async function mentionChecks(open: Open, fact: Check): Promise<void> {
  for (const [size, touch] of [
    [{ width: 1440, height: 900 }, false],
    [{ width: 390, height: 844 }, true],
  ] as const) {
    const on = touch ? 'phone touch' : 'desktop keyboard';
    const send = async (scope: Locator, field: Locator): Promise<void> => {
      if (touch)
        await scope
          .getByRole('button', { name: /^(Post|Reply)$/ })
          .first()
          .tap();
      else await field.press('Control+Enter');
    };
    const page = await open('/', { mock: { live: false, threads: true } }, size, touch);
    const front = async (kind: string): Promise<void> => {
      const tab = page.locator(`.tab[data-view="${kind}"]`).first();
      if (touch) await tab.tap();
      else await tab.click();
    };

    // The Post tab.
    await front('compose');
    const post = page.locator(`${COMPOSE} textarea`).first();
    await post.waitFor();
    const said = `post mention ${on}`;
    await post.fill(said);
    await choose(page, fact, `${on} Post`, post, touch);
    await send(page.locator(COMPOSE), post);
    await front('home');
    await opens(page, fact, `${on} Post`, HOME, said, touch);

    // The field under a thread's focus.
    await front('home');
    const note = page.locator(`${HOME} ${replyable}`).first();
    await note.waitFor();
    const answer = note.locator('.acts > .a-reply');
    if (touch) await answer.tap();
    else await answer.click();
    const say = page.locator(`${THREAD} .tsay textarea`).first();
    await say.waitFor();
    const replied = `reply mention ${on}`;
    await say.fill(replied);
    await choose(page, fact, `${on} inline Reply`, say, touch);
    await send(page.locator(`${THREAD} .tsay`), say);
    await opens(page, fact, `${on} inline Reply`, THREAD, replied, touch);

    // Quote.
    await front('home');
    const quoted = page.locator(`${HOME} .note:has(.a-repost:not(.off))`).first();
    const repost = quoted.locator('.acts > .a-repost');
    if (touch) await repost.tap();
    else await repost.click();
    const item = page.getByRole('menuitem', { name: 'Quote' });
    if (touch) await item.tap();
    else await item.click();
    const field = page.locator(`${COMPOSE} textarea`).first();
    await field.waitFor();
    // The open Post tab takes the quote, as a card under the field; on a desktop Home stays in view beside it.
    fact(
      `${on} Quote: the Post tab shows the quoted note as a card`,
      (await page.locator(`${COMPOSE} .cquote .qhead .name`).count()) === 1 &&
        (await page.locator('.tab[data-view^="compose"]').count()) === 1 &&
        (touch || (await page.locator(HOME).count()) === 1),
      await page.locator('.tab').evaluateAll((t) => t.map((x) => x.getAttribute('data-view'))),
    );
    const quoting = `quote mention ${on}`;
    await field.fill(quoting);
    await choose(page, fact, `${on} Quote`, field, touch);
    await send(page.locator(COMPOSE), field);
    await front('home');
    await opens(page, fact, `${on} Quote`, HOME, quoting, touch);
    await page.context().close();
  }
  await waiting(open, fact);
}

/** While a post signs and sends, Home already shows its mention as the link the note will have; a name nobody seen
 * here matches says so without taking Enter; an npub after @ finds its person. */
async function waiting(open: Open, fact: Check): Promise<void> {
  const page = await open('/', {
    mock: { live: false, slow: { when: 'slowly', sign: 4000, relays: 3000 } },
  });
  await page.locator('.tab[data-view="compose"]').first().click();
  const field = page.locator(`${COMPOSE} textarea`).first();
  await field.fill('pending mention slowly');
  await choose(page, fact, 'pending Post', field, false);
  await field.press('Control+Enter');
  const draft = page.locator(`${HOME} .home-draft`, { hasText: 'pending mention slowly' });
  await draft.waitFor();
  fact(
    'pending Post: Home shows the waiting note with its mention as a link',
    (await draft.locator('.content > .text .lnk', { hasText: `@${NAME}` }).count()) === 1,
    await draft.locator('.content > .text').innerText(),
  );
  const waited = await draft.locator('.content > .text .lnk').first().innerText();
  const note = page.locator(`${HOME} .note:not(.home-draft)`, {
    hasText: 'pending mention slowly',
  });
  await note.first().waitFor({ timeout: 15000 });
  fact(
    'pending Post: the published note links the same label the waiting one did',
    (await note.first().locator('.content > .text .lnk').first().innerText()) === waited,
  );
  await field.fill('');
  await field.pressSequentially('@zqx', { delay: 30 });
  await page.locator(`${MENU} .mention-quiet`).waitFor();
  fact(
    'a name nobody seen here matches says so, with no choice to take',
    (await page.locator(`${MENU} .mention-quiet`).innerText()).includes('zqx') &&
      (await page.locator(OPTION).count()) === 0,
  );
  await field.press('Enter');
  fact('Enter there still starts a new line', (await field.inputValue()) === '@zqx\n');
  await field.fill('');
  await field.pressSequentially(`@${byHandle('lena').author.npub}`);
  await page.locator(OPTION, { hasText: NAME }).first().waitFor();
  fact('an npub after @ finds its person', (await page.locator(OPTION).count()) === 1);
  await page.context().close();
}
