// The mention a note in Home links to, waiting or published: its label and the person its link opens, so the waiting
// draft and the published note can be compared exactly (owner, 2026-11-21: mentions must not read as plain text while
// a post is on its way).
import { front, view } from './smoke-wish-support.mjs';

/** Presses the first mention link of the Home entry matching `select` and `text`; returns to `back`. */
export async function mentionTarget(page, select, text, back) {
  await front(page, 'home');
  const note = page.locator(`${view('home')} ${select}`, { hasText: text }).first();
  await note.waitFor();
  const link = note.locator('.content > .text .lnk').first();
  const label = (await link.innerText()).trim();
  await link.click();
  const head = page.locator(`${view('profile')} .profile`);
  await head.waitFor();
  const npub = (await head.locator('.npub').first().innerText()).trim();
  const name = await head.innerText();
  await page.locator('.pane.cur .tab.active[data-view^="profile"]').click({ button: 'middle' });
  await front(page, back);
  return { label, npub, name };
}

/** The waiting draft (real engine, signer held) against the published note: same label, same person. */
export async function mentionCompare({ page, real, fact, candidate, release, sent }) {
  const pending = real ? await mentionTarget(page, '.home-draft', 'wish queued', 'compose') : null;
  await release();
  await sent();
  const published = await mentionTarget(page, '.note:not(.home-draft)', 'wish queued', 'compose');
  fact(
    '5 the published mention opens its person',
    published.name.includes(candidate.author.name) && published.npub === candidate.author.npub,
  );
  if (pending)
    fact(
      '5 the waiting and published notes link the same person under the same label',
      pending.label === published.label && pending.npub === published.npub,
    );
}
