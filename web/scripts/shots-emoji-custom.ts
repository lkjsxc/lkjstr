// E4 scenes: the picker's custom emoji tab. Its one button goes to the reader's own list and each set it names, under
// their own headings, and a custom emoji is shown large in the strip (pointed at on a desktop, held by a finger on a
// phone, which does not pick); a typed shortcode finds custom and standard emoji under their own headings, the best
// first; and a reader with no list is told in one line how to get one. Each scene checks what it is meant to prove.
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { centre, gridBox, hold, phone, type Scene, seed } from './shots-emoji.ts';

export const EMOJI_CUSTOM_SCENES = [
  'emoji-custom',
  'emoji-custom-search',
  'emoji-custom-empty',
] as const;

const tab = '.epick .ecats button[data-section="custom"]';
async function open(page: Page, used = true): Promise<void> {
  if (used) await seed(page);
  await page.keyboard.press('n');
  await page.locator('.view[data-kind="compose"]:visible .icon:has(.i-smile)').first().click();
  await page.locator('.epick .egroup[data-section="cat:0"] .ecell').first().waitFor();
}
const press = (page: Page, selector: string): Promise<void> =>
  phone(page) ? page.locator(selector).tap() : page.locator(selector).click();
/** The custom tab is the one lit, and the first custom heading is at the top of the grid. */
async function atCustom(page: Page): Promise<string> {
  assert.ok(await page.locator(tab).evaluate((b) => b.classList.contains('on')), 'the tab is lit');
  return page.locator('.epick .egrid').evaluate((g) => {
    const first = g.querySelector<HTMLElement>('.egroup[data-cat="custom"]');
    if (!first || Math.abs(g.scrollTop - first.offsetTop) > 1) return '';
    return first.dataset.section ?? '';
  });
}

export async function emojiCustomShots(scene: Scene): Promise<void> {
  await scene('emoji-custom', '/', async (page) => {
    await open(page);
    assert.equal(await page.locator('.epick .ecats button').count(), 11, 'one tab for every set');
    await press(page, tab);
    assert.equal(await atCustom(page), 'mine');
    const groups = await page
      .locator('.epick .egroup[data-cat="custom"]')
      .evaluateAll((gs) => gs.map((g) => g.getAttribute('data-section') ?? ''));
    assert.match(groups.join(' '), /^mine set:30030:\w+:kotoba set:30030:\w+:kurashi$/);
    const before = await gridBox(page);
    // A set's emoji, large in the strip with its code and set.
    const cell = `.epick .egroup[data-section="${groups[1]}"] .ecell:nth-child(2)`;
    if (phone(page)) {
      const [x, y] = await centre(page, cell);
      await hold(page, x, y);
      assert.equal(await page.locator('.epick').count(), 1, 'a long press does not pick');
    } else await page.locator(cell).hover();
    await page.locator('.eprev .ename:text-is(":nostr:")').waitFor();
    assert.equal(await page.locator('.eprev .ecode').textContent(), 'ことば');
    const big = await page.locator('.eprev .ebig').boundingBox();
    assert.ok(
      big && Math.round(big.width) === 72 && Math.round(big.height) === 72,
      'shown at 72 px',
    );
    assert.equal(await gridBox(page), before, 'the grid stays still while the preview changes');
  });
  await scene('emoji-custom-search', '/', async (page) => {
    await open(page);
    // A shortcode as it is written in text, begun in the tab: the reader's own codes lead, then the standard ones.
    await press(page, tab);
    await page.locator('.epick input').fill(':ne');
    const heads = await page.locator('.epick .egrid .ehd').allTextContents();
    const ja = await page.evaluate(() => document.documentElement.lang === 'ja');
    assert.deepEqual(
      heads,
      ja ? ['カスタム絵文字', '標準の絵文字'] : ['Custom emoji', 'Standard emoji'],
    );
    assert.ok(await page.locator(tab).evaluate((b) => b.classList.contains('on')), 'still the tab');
    await page.keyboard.press('ArrowDown');
    assert.match((await page.locator('.eprev .ename').textContent()) ?? '', /^:ne[a-z-]*:$/);
  });
  await scene(
    'emoji-custom-empty',
    '/',
    async (page) => {
      await open(page, false);
      await press(page, tab);
      assert.equal(await atCustom(page), 'custom');
      const line = page.locator('.epick .egroup[data-section="custom"] .enote');
      assert.equal(await line.count(), 1);
      const lines = await line.evaluate((e) => {
        const r = document.createRange();
        r.selectNodeContents(e);
        return new Set([...r.getClientRects()].map((b) => Math.round(b.top))).size;
      });
      assert.ok(lines <= 2, `one short line, not an essay (${lines})`);
    },
    '{"live":false,"emoji":"none"}',
  );
}
