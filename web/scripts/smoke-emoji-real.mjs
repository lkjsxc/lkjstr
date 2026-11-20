// The emoji picker against the real engine: the reader's own list (kind 10030) and a set it names (kind 30030) on
// the loopback relay, picked in the composer and as a reaction; the published events carry the NIP-30 tag with the
// picture and, for the set's emoji, the set address. Images point at https addresses this run cannot reach, so the
// picker's cells show their codes: the fallback is exercised too.

export async function emojiRealChecks({ page, fake, check, addWish, owner, launch }) {
  const set = `30030:${owner}:lkjstr-smoke`;
  const own = { code: 'smoke_cat', url: 'https://emoji.invalid/cat.png' };
  const listed = { code: 'smoke-dog', url: 'https://emoji.invalid/dog.png' };
  await addWish(
    30030,
    '',
    [
      ['d', 'lkjstr-smoke'],
      ['title', 'Smoke set'],
      ['emoji', listed.code, listed.url],
    ],
    owner,
  );
  await addWish(
    10030,
    '',
    [
      ['emoji', own.code, own.url],
      ['a', set],
    ],
    owner,
  );

  await launch('Post', 'compose');
  const compose = page.locator('.pane.cur .view[data-kind="compose"]:visible');
  const text = `emoji smoke ${Date.now()} `;
  await compose.locator('textarea').fill(text);
  await compose.locator('.icon:has(.i-smile)').click();
  const setCell = page.locator('.epick .egroup[data-section="set:Smoke set"] .ecell').first();
  await setCell.waitFor({ timeout: 15000 });
  // The pictures cannot be had here: each cell says its code instead.
  await setCell.locator('.efail').waitFor();
  await page.locator('.epick .egroup[data-section="set:"] .ecell .efail').first().waitFor();
  check(
    "the picker shows the reader's own list and the set it names, a failed picture as its code",
    (await page
      .locator('.epick .egroup[data-section="set:"] .ecell', { hasText: `:${own.code}:` })
      .count()) === 1 && (await setCell.innerText()) === `:${listed.code}:`,
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
    reacted()?.tags.some((t) => t[0] === 'emoji' && t[1] === own.code && t[2] === own.url) === true,
  );
}
