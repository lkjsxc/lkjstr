// A1/A2 use real view components and the actual mock Worker, with no product words or styling injected.
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { en } from '../src/shared/strings-en.ts';
import { ja } from '../src/shared/strings-ja.ts';
import { actNotificationScene } from './shots-acts-fixture.ts';
import { ACT_SPEC_SCENES, ACT_VERIFICATION_SCENES } from './shots-spec-scenes.ts';

type Scene = (name: string, path: string, act: (page: Page) => Promise<void>) => Promise<void>;
export async function actsShots(
  scene: Scene,
  notifications: (page: Page) => Promise<void>,
  lang: 'ja' | 'en',
): Promise<void> {
  const words = lang === 'ja' ? ja : en;
  for (const name of [...ACT_SPEC_SCENES, ...ACT_VERIFICATION_SCENES]) {
    if (name.startsWith('profile-')) {
      await scene(name, '/p/aoi', async (page) => {
        const view = page.locator('.view[data-kind="profile"]:visible').last();
        const kind = name === 'profile-reactions-chain' ? 'reactions' : 'reposts';
        await view.getByRole('tab', { name: words[`pkind.${kind}`], exact: true }).click();
        await view.locator('.act-context').nth(1).waitFor();
        const rows = view.locator('.list .note[data-note]');
        const first = await rows.evaluateAll((elements) =>
          elements.slice(0, 3).map((el) => ({
            id: (el as HTMLElement).dataset.note,
            context: !!el.querySelector('.act-context'),
          })),
        );
        assert.deepEqual(
          first.map((row) => row.context),
          [false, true, true],
        );
        assert.equal(new Set(first.map((row) => row.id)).size, 3);
        // Fixture-owned scrolling exposes all context lines; this is not a reading-anchor assertion.
        await rows.first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
      });
      continue;
    }
    await scene(name, '/', async (page) => {
      await actNotificationScene(page, name);
      await notifications(page);
      const view = page.locator('.view[data-kind="notifications"]:visible').last();
      const row = view.locator('.notif');
      await row.locator('.act-target').waitFor();
      assert.equal(await row.count(), 1);
      const text = await row.locator('.act-target').innerText();
      if (name === 'notif-act-reaction') {
        assert.equal(await row.locator('.nfaces .avb').count(), 2);
        assert.equal(await row.locator('.nmark .emo').count(), 1);
        assert.equal(await row.locator('.act-target .rchip').innerText(), '⭐');
      } else if (name === 'notif-act-repost') {
        assert.equal(await row.locator('.act-target .i-repost').count(), 1);
      } else {
        const key =
          name === 'notif-act-pending'
            ? 'act.note.pending'
            : name === 'notif-act-failed'
              ? 'quote.error'
              : 'act.note.missing';
        assert.ok(text.includes(words[key]));
      }
      await row.scrollIntoViewIfNeeded();
      assert.equal(await view.evaluate((el) => el.scrollWidth > el.clientWidth + 1), false);
    });
  }
}
