// E7: the same shortcode in two sets, with its own image, preview and reaction chip.
import assert from 'node:assert/strict';
import { centre, gridBox, hold, phone, type Scene } from './shots-emoji.ts';

export const EMOJI_COLLISION_SCENES = ['emoji-collision', 'emoji-collision-chips'] as const;
const matches = '.epick .egroup[data-section="found:custom"] .ecell';
const chips = '.note .rchip[data-emoji=":pien:"]';

export async function emojiCollisionShots(scene: Scene): Promise<void> {
  await scene('emoji-collision', '/', async (page) => {
    await page.keyboard.press('n');
    await page.locator('.view[data-kind="compose"]:visible .icon:has(.i-smile)').first().click();
    await page.locator('.epick input').fill(':pien');
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length === 2,
      matches,
    );
    const cells = page.locator(matches);
    const names = await cells.evaluateAll((items) =>
      items.map((item) => item.getAttribute('aria-label')),
    );
    assert.ok(names[0]?.includes('ことば'), 'first collision names its set');
    assert.ok(names[1]?.includes('くらし'), 'second collision names its set');
    const urls = await cells
      .locator('img')
      .evaluateAll((images) => images.map((image) => image.getAttribute('src')));
    assert.equal(new Set(urls).size, 2, 'both pictures are distinct');
    const before = await gridBox(page);
    const target = `${matches}:nth-child(2)`;
    if (phone(page)) {
      const [x, y] = await centre(page, target);
      await hold(page, x, y);
      assert.equal(await page.locator('.epick').count(), 1, 'a long press does not pick');
    } else await page.locator(target).hover();
    await page.locator('.eprev .ename:text-is(":pien:")').waitFor();
    assert.equal(await page.locator('.eprev .ecode').textContent(), 'くらし');
    assert.equal(await gridBox(page), before, 'preview changes do not move the grid');
    const box = await page.locator('.eprev .ebig').boundingBox();
    assert.ok(box && Math.round(box.width) === 72 && Math.round(box.height) === 72);
  });

  await scene('emoji-collision-chips', '/', async (page) => {
    await page.locator(chips).first().waitFor();
    const row = page
      .locator('.note')
      .filter({ has: page.locator('.rchip[data-emoji=":pien:"]') })
      .first();
    const pair = row.locator('.rchip[data-emoji=":pien:"]');
    assert.equal(await pair.count(), 2);
    assert.deepEqual(await pair.locator('span').allTextContents(), ['8', '3']);
    assert.equal(await pair.nth(0).getAttribute('aria-pressed'), 'true');
    assert.equal(await pair.nth(1).getAttribute('aria-pressed'), 'false');
    const urls = await pair
      .locator('img')
      .evaluateAll((images) => images.map((image) => image.getAttribute('src')));
    assert.equal(new Set(urls).size, 2, 'same code has two reaction pictures');
    const id = await row.getAttribute('data-note');
    assert.ok(id);
    const target = `.note[data-note="${id}"] .rchip[data-emoji=":pien:"]:last-child`;
    await page.locator(target).scrollIntoViewIfNeeded();
    if (phone(page)) {
      const [x, y] = await centre(page, target);
      await hold(page, x, y);
    } else await page.locator(target).locator('img.emo').hover();
    await page.locator('.epeek .ename:text-is(":pien:")').waitFor();
    assert.equal(await page.locator('.epeek .ecode').textContent(), 'くらし');
    assert.deepEqual(
      await pair.locator('span').allTextContents(),
      ['8', '3'],
      'preview does not react',
    );
    assert.equal(await pair.nth(1).getAttribute('aria-pressed'), 'false');
  });
}
