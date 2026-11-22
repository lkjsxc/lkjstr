// E7 uses the existing owned relay and signer: three pictures share one shortcode.
export const COLLISIONS = [
  { code: 'pien', url: 'https://emoji.invalid/pien-own.png', d: '' },
  { code: 'pien', url: 'https://emoji.invalid/pien-one.png', d: 'lkjstr-smoke' },
  { code: 'pien', url: 'https://emoji.invalid/pien-two.png', d: 'lkjstr-smoke-alternate' },
];
export const alternateSetOf = (owner) => '30030:' + owner + ':lkjstr-smoke-alternate';
const group = (id) => '.epick .egroup[data-section="' + id + '"]';
const cell = (id) => group(id) + ' .ecell[aria-label^=":pien:"]';

// Preserve the actual rendered URL on its fixture cell before the image becomes fallback text.
export async function rememberEmojiPictures(page) {
  return page.evaluateHandle(() => {
    const remember = () => {
      for (const image of document.querySelectorAll('.epick .ecell img[src]')) {
        const cell = image.closest('.ecell');
        if (cell) cell.setAttribute('data-smoke-emoji-url', image.getAttribute('src'));
      }
    };
    const observer = new MutationObserver(remember);
    observer.observe(document.body, { childList: true, subtree: true });
    remember();
    return observer;
  });
}

export const emojiCell = (page, source, code, url) =>
  page.locator(
    group(source) +
      ' .ecell[aria-label^=' +
      JSON.stringify(':' + code + ':') +
      '][data-smoke-emoji-url=' +
      JSON.stringify(url) +
      ']',
  );

export async function emojiCollisionChecks({ page, fake, check, owner, launch }) {
  const firstSet = '30030:' + owner + ':lkjstr-smoke';
  const secondSet = alternateSetOf(owner);
  await launch('Post', 'compose');
  const compose = page.locator('.pane.cur .view[data-kind="compose"]:visible');
  const text = compose.locator('textarea');
  await text.fill('emoji collision ' + Date.now() + ' ');
  const smile = compose.locator('.icon:has(.i-smile)');
  await smile.click();
  await emojiCell(page, secondSet, COLLISIONS[2].code, COLLISIONS[2].url).waitFor();
  check(
    'all three sources keep their same-code cells outside search',
    (await page.locator(cell('10030:' + owner + ':')).count()) === 1 &&
      (await page.locator(cell(firstSet)).count()) === 1 &&
      (await page.locator(cell(secondSet)).count()) === 2,
  );
  await page.locator('.epick input').fill(':pien');
  const found = page.locator(group('found:custom') + ' .ecell');
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.epick .egroup[data-section="found:custom"] .ecell').length === 3,
  );
  const names = await found.evaluateAll((cells) =>
    cells.map((c) => c.getAttribute('aria-label') ?? ''),
  );
  check(
    'search offers one same-code cell per picture and names each source',
    names.length === 3 &&
      new Set(names).size === 3 &&
      names.some((name) => name.includes('Smoke set')) &&
      names.some((name) => name.includes('Smoke alternate')),
  );
  await page.locator('.epick input').fill('');
  for (const [index, source] of ['10030:' + owner + ':', firstSet, secondSet].entries()) {
    if (index) await smile.click();
    await emojiCell(page, source, COLLISIONS[index].code, COLLISIONS[index].url).click();
  }
  const content = await text.inputValue();
  const aliases = ['pien', 'pien_2', 'pien_3'];
  check(
    'one draft keeps all three pictures under separate shortcode aliases',
    aliases.every((code) => content.includes(':' + code + ':')),
  );
  await compose.getByRole('button', { name: 'Post', exact: true }).click();
  const posted = () =>
    fake.published.find((event) => event.kind === 1 && event.content === content);
  for (let n = 0; n < 400 && !posted(); n++) await page.waitForTimeout(25);
  const published = posted();
  check(
    'posted aliases retain their selected image and set address',
    !!published &&
      COLLISIONS.every((entry, index) =>
        published.tags.some(
          (tag) =>
            tag[0] === 'emoji' &&
            tag[1] === aliases[index] &&
            tag[2] === entry.url &&
            (entry.d ? tag[3] === '30030:' + owner + ':' + entry.d : tag[3] === undefined),
        ),
      ),
  );
  if (!published) throw new Error('collision note was not published');
  await page.locator('.tab[data-view="global"]').click();
  const note = page
    .locator('.view[data-kind="global"] .note[data-note="' + published.id + '"]')
    .first();
  await note.waitFor();
  await note.locator('.a-smile').click();
  await page.locator('.epick input').fill(':pien');
  await emojiCell(page, 'found:custom', COLLISIONS[2].code, COLLISIONS[2].url).click();
  const reacted = () =>
    fake.published.find(
      (event) =>
        event.kind === 7 &&
        event.content === ':pien:' &&
        event.tags.some((tag) => tag[0] === 'e' && tag[1] === published.id) &&
        event.tags.some((tag) => tag[0] === 'emoji' && tag[2] === COLLISIONS[2].url),
    );
  for (let n = 0; n < 480 && !reacted(); n++) await page.waitForTimeout(25);
  check(
    'the selected collision reaction signs its original code and own picture',
    reacted()?.tags.some(
      (tag) =>
        tag[0] === 'emoji' &&
        tag[1] === 'pien' &&
        tag[2] === COLLISIONS[2].url &&
        tag[3] === secondSet,
    ) === true,
  );
}
