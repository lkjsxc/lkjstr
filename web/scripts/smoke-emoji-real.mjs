// The emoji picker against the real engine: the reader's own list (kind 10030) and a set it names (kind 30030) on
// the loopback relay, picked in the composer and as a reaction; the published events carry the NIP-30 tag with the
// picture and, for the set's emoji, the set address. Images point at https addresses this run cannot reach, so the
// picker's cells show their codes: the fallback is exercised too.

import {
  alternateSetOf,
  COLLISIONS,
  emojiCell,
  emojiCollisionChecks,
  rememberEmojiPictures,
} from './smoke-emoji-collision-real.mjs';
import { smokePath } from './smoke-output.ts';

const OWN = { code: 'smoke_cat', url: 'https://emoji.invalid/cat.png' };
const LISTED = { code: 'smoke-dog', url: 'https://emoji.invalid/dog.png' };
const setOf = (owner) => `30030:${owner}:lkjstr-smoke`;

/** The reader's list and the set it names, added just before the check (so they change nothing the earlier checks
 * see). The loopback store drops what exceeds its bound: a dropped event fails here, by name. */
export async function seedEmoji({ fake, addWish, owner }) {
  const events = [
    await addWish(
      30030,
      '',
      [
        ['d', 'lkjstr-smoke'],
        ['title', 'Smoke set'],
        ['emoji', LISTED.code, LISTED.url],
        ['emoji', COLLISIONS[1].code, COLLISIONS[1].url],
      ],
      owner,
    ),
    await addWish(
      30030,
      '',
      [
        ['d', 'lkjstr-smoke-alternate'],
        ['title', 'Smoke alternate'],
        ['emoji', COLLISIONS[2].code, COLLISIONS[2].url],
        ['emoji', COLLISIONS[1].code, COLLISIONS[1].url],
      ],
      owner,
    ),
    await addWish(
      10030,
      '',
      [
        ['emoji', OWN.code, OWN.url],
        ['emoji', COLLISIONS[0].code, COLLISIONS[0].url],
        ['a', setOf(owner)],
        ['a', alternateSetOf(owner)],
      ],
      owner,
    ),
  ];
  if (!events.every((e) => fake.stored.some((s) => s.id === e.id)))
    throw new Error('emoji fixtures were not stored');
}

export async function emojiRealChecks({ page, fake, check, owner, launch }) {
  const pictures = await rememberEmojiPictures(page);
  try {
    const set = setOf(owner);
    const own = OWN;
    const listed = LISTED;
    await launch('Post', 'compose');
    const compose = page.locator('.pane.cur .view[data-kind="compose"]:visible');
    const text = `emoji smoke ${Date.now()} `;
    await compose.locator('textarea').fill(text);
    const smile = compose.locator('.icon:has(.i-smile)');
    await smile.click();
    // One opening brings the reader's own list, drawn at the top, and the set it names: the list arrives during this
    // opening (it was never read before), so the set is asked for on the engine's next round.
    const setCell = emojiCell(page, set, listed.code, listed.url);
    const ownCell = emojiCell(page, `10030:${owner}:`, own.code, own.url);
    try {
      await setCell.waitFor({ timeout: 15000 });
    } catch {
      // Say what did arrive: the sections drawn, the lists asked for, and who posted last.
      await page.screenshot({ path: smokePath('screens/emoji-real-failure.png') });
      const detail = {
        sections: await page
          .locator('.epick .egroup')
          .evaluateAll((gs) =>
            gs.map((g) => `${g.dataset.section}:${g.querySelectorAll('.ecell').length}`),
          ),
        asked: fake.activeFilters().filter((f) => f.kinds?.some((k) => k === 10030 || k === 30030)),
        poster: fake.published.filter((e) => e.kind === 1).at(-1)?.pubkey === owner,
        stored: fake.stored
          .filter((e) => e.kind === 10030 || e.kind === 30030)
          .map((e) => e.pubkey === owner),
      };
      throw new Error(`the reader's emoji sets did not arrive: ${JSON.stringify(detail)}`);
    }
    check(
      "the picker's first opening draws the reader's own list at the top",
      (await page.locator('.epick .egroup').first().getAttribute('data-section')) ===
        `10030:${owner}:` &&
        (await page.locator('.epick .egrid').evaluate((g) => g.scrollTop)) === 0,
    );
    // The pictures cannot be had here: each cell says its code instead.
    await setCell.locator('.efail').waitFor();
    await ownCell.locator('.efail').waitFor();
    check(
      "the picker shows the reader's own list and the set it names, a failed picture as its code",
      (await ownCell.count()) === 1 &&
        (await ownCell.innerText()) === `:${own.code}:` &&
        (await setCell.innerText()) === `:${listed.code}:`,
    );
    await setCell.hover();
    check(
      'the preview names the custom emoji and its set',
      (await page.locator('.eprev .ename').innerText()) === `:${listed.code}:` &&
        (await page.locator('.eprev .ecode').innerText()) === 'Smoke set',
    );
    await setCell.click();
    await compose.getByRole('button', { name: 'Post', exact: true }).click();
    const posted = () =>
      fake.published.find((e) => e.kind === 1 && e.content === `${text}:${listed.code}:`);
    for (let n = 0; n < 400 && !posted(); n++) await page.waitForTimeout(25);
    check(
      'a picked custom emoji publishes its code, picture and set address',
      posted()?.tags.some(
        (t) => t[0] === 'emoji' && t[1] === listed.code && t[2] === listed.url && t[3] === set,
      ) === true,
    );

    await page.locator('.tab[data-view="global"]').click();
    const note = page.locator('.view[data-kind="global"] .note').filter({ hasText: text.trim() });
    await note.first().waitFor();
    await note.first().locator('.a-smile').click();
    await page.locator('.epick input').fill('smoke cat');
    await page.locator('.epick input').press('Enter');
    const reacted = () => fake.published.find((e) => e.kind === 7 && e.content === `:${own.code}:`);
    // A reaction waits out its Undo before it is sent.
    for (let n = 0; n < 480 && !reacted(); n++) await page.waitForTimeout(25);
    check(
      'a custom reaction found by its words carries its emoji tag',
      reacted()?.tags.some((t) => t[0] === 'emoji' && t[1] === own.code && t[2] === own.url) ===
        true,
    );
    await emojiCollisionChecks({ page, fake, check, owner, launch });
  } finally {
    await pictures.evaluate((observer) => observer.disconnect());
    await pictures.dispose();
  }
}
