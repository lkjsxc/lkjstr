// E1 scenes: the emoji picker with its preview strip (pointer, keyboard, a resting finger on a phone), a search, the
// skin tones, and the popover over a custom emoji in a note. Each also checks what the picture is meant to prove:
// the grid does not move while the preview changes, and the preview and popover take no press.
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';

type Scene = (name: string, path: string, act: (page: Page) => Promise<void>) => Promise<void>;
export const EMOJI_SCENES = [
  'emoji-preview',
  'emoji-search',
  'emoji-tones',
  'emoji-peek',
  'emoji-peek-keys',
  'emoji-reaction',
] as const;

const phone = (page: Page): boolean => (page.viewportSize()?.width ?? 1000) < 500;
/** A finger resting on a point, as long as a long press. */
async function hold(page: Page, x: number, y: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(650);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
const centre = async (page: Page, selector: string): Promise<[number, number]> => {
  const box = await page.locator(selector).first().boundingBox();
  assert.ok(box, `${selector} is drawn`);
  return [box.x + box.width / 2, box.y + box.height / 2];
};
/** Earlier picks on this device, so "Frequently used" has something in it. */
async function seed(page: Page): Promise<void> {
  const otsu = await page.locator('.note img.emo[alt=":otsu:"]').first().getAttribute('src');
  const at = Date.now();
  const used = [
    { emoji: '🙏', n: 6, at },
    { emoji: '🔥', n: 4, at: at - 9 },
    { emoji: ':otsu:', url: otsu, n: 3, at: at - 8 },
    { emoji: '😂', n: 3, at: at - 7 },
    { emoji: '👍🏽', n: 2, at: at - 6 },
    { emoji: '🎉', n: 2, at: at - 5 },
    { emoji: '🍵', n: 1, at: at - 4 },
  ];
  await page.evaluate((v) => localStorage.setItem('lkjstr:emoji:used', JSON.stringify(v)), used);
}
async function openFromComposer(page: Page): Promise<void> {
  await seed(page);
  await page.keyboard.press('n');
  await page.locator('.view[data-kind="compose"]:visible .icon:has(.i-smile)').first().click();
  await page.locator('.epick .ecell').first().waitFor();
  await page.locator('.epick .egroup[data-section="cat:0"] .ecell').first().waitFor();
}
const gridBox = (page: Page) =>
  page.locator('.epick .egrid').evaluate((g) => {
    const r = g.getBoundingClientRect();
    return `${r.x},${r.y},${r.width},${r.height},${g.scrollTop}`;
  });

export async function emojiShots(scene: Scene): Promise<void> {
  await scene('emoji-preview', '/', async (page) => {
    await openFromComposer(page);
    const before = await gridBox(page);
    // Desktop points at a Unicode emoji, the phone rests on the reader's own custom one.
    const used = '.epick .egroup[data-section="used"] .ecell';
    const target = `${used}:nth-child(${phone(page) ? 3 : 4})`;
    if (phone(page)) {
      const [x, y] = await centre(page, target);
      await hold(page, x, y);
      assert.equal(await page.locator('.epick').count(), 1, 'a long press does not pick');
    } else {
      await page.locator(target).hover();
    }
    await page.locator('.eprev .ename:not(:empty)').waitFor();
    assert.equal(await gridBox(page), before, 'the grid stays still while the preview changes');
    // The strip takes no press: a press there reaches what is under it, never the grid.
    assert.equal(
      await page.locator('.eprev').evaluate((e) => getComputedStyle(e).pointerEvents),
      'none',
    );
  });
  await scene('emoji-search', '/', async (page) => {
    await openFromComposer(page);
    const before = await gridBox(page);
    const ja = await page.evaluate(() => document.documentElement.lang === 'ja');
    await page.locator('.epick input').fill(ja ? 'ねこ' : 'cat');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.locator('.eprev .ename:not(:empty)').waitFor();
    assert.equal(
      (await gridBox(page)).split(',').slice(0, 4).join(),
      before.split(',').slice(0, 4).join(),
    );
  });
  await scene('emoji-tones', '/', async (page) => {
    await openFromComposer(page);
    await page.locator('.epick .etone').click();
    await page.locator('.etones button').nth(3).click();
    await page.locator('.epick .egroup[data-section="cat:1"]').evaluate((g) => {
      const grid = g.closest('.egrid') as HTMLElement;
      grid.scrollTop = (g as HTMLElement).offsetTop;
    });
    await page.locator('.epick .etone').click();
    await page.locator('.etones button[aria-checked="true"]').waitFor();
  });
  await scene('emoji-peek', '/', async (page) => {
    const emoji = '.note .text img.emo';
    await page.locator(emoji).first().scrollIntoViewIfNeeded();
    if (phone(page)) {
      const [x, y] = await centre(page, emoji);
      await hold(page, x, y);
      assert.equal(await page.locator('.view[data-kind="thread"]').count(), 0, 'no thread opened');
    } else await page.locator(emoji).first().hover();
    await page.locator('.epeek:not([hidden])').waitFor();
    assert.equal(
      await page.locator('.epeek').evaluate((e) => getComputedStyle(e).pointerEvents),
      'none',
    );
  });
  await scene('emoji-peek-keys', '/', async (page) => {
    // Tab from the author's name to the first custom emoji in the text.
    const emoji = page.locator('.note .text img.emo').first();
    await emoji.scrollIntoViewIfNeeded();
    const owner = page.locator('.note').filter({ has: page.locator('.text img.emo') });
    await owner.first().locator('.name').first().focus();
    for (let n = 0; n < 12; n++) {
      if (await page.evaluate(() => document.activeElement?.matches('img.emo') === true)) break;
      await page.keyboard.press('Tab');
    }
    await page.locator('.epeek').waitFor();
    assert.ok(await page.evaluate(() => document.activeElement?.matches('.note .text img.emo')));
  });
  await scene('emoji-reaction', '/', async (page) => {
    const chip = page.locator('.note .rchip:has(img.emo)').first();
    await chip.scrollIntoViewIfNeeded();
    if (phone(page)) {
      const box = await chip.boundingBox();
      assert.ok(box);
      await hold(page, box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await chip.getAttribute('aria-pressed'), 'false', 'a long press does not react');
    } else await chip.locator('img.emo').hover();
    await page.locator('.epeek:not([hidden])').waitFor();
  });
}
