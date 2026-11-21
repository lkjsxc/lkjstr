// Hidden notes (docs/interface-hidden.md) on the mock: one line per reason in the note's slot, Why inline with the
// reason's own setting, Show and Hide in place with the reading place held, a reload keeps a shown note shown, the
// keys pass over the line, a content warning folds only the body, and end lines per cause only where reported.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Locator, Page } from 'playwright-core';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (
  path: string,
  given: Record<string, unknown>,
  size?: { width: number; height: number },
  touch?: boolean,
) => Promise<Page>;

const list = '.view[data-kind="global"]:visible';
const warningRow = (page: Page): Locator =>
  page
    .locator(`${list} .note`, {
      has: page.locator('.nmain > .cw', { hasText: '今期のアニメ最終回' }),
    })
    .first();
const one = (tabs: string[]) => ({ type: 'pane', id: 'a', tabs, active: tabs[0] });
const REASONS: [string, boolean][] = [
  ['In another language.', true],
  ['Has a word you muted.', true],
  ['Deleted by its author.', false],
  ['From someone you muted.', true],
  ['Looks like machine data, not a post.', true],
  ['Past the end time its author set.', false],
];
const lineOf = (page: Page, text: string): Locator =>
  page.locator(`${list} .note.hid`, { hasText: text }).first();

/** Scrolls the list down until `loc` is drawn, then brings it to the middle. */
async function reach(page: Page, loc: Locator): Promise<boolean> {
  if (!(await loc.count())) await page.locator(list).evaluate((v) => (v.scrollTop = 0));
  for (let i = 0; i < 60 && !(await loc.count()); i++) {
    await page.locator(list).evaluate((v) => v.scrollBy(0, 500));
    await page.waitForTimeout(60);
  }
  if (!(await loc.count())) return false;
  await loc.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(120);
  return true;
}
const box = (loc: Locator) =>
  loc.evaluate((n) => {
    const r = n.getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height) };
  });

const sizes = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
async function capture(page: Page, label: string): Promise<void> {
  if (process.env.LKJSTR_SHOTS !== '1') return;
  const directory = resolve('../tmp/hidden-note-shots');
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, `${label}.png`) });
}

export async function hiddenChecks(open: Open, fact: Check): Promise<void> {
  for (const size of sizes) {
    const on = size.width > 600 ? 'desktop' : 'phone';
    const phone = on === 'phone';
    const page = await open(
      '/',
      { mock: { live: false }, 'layout:main': one(['global']) },
      size,
      phone,
    );
    const seen: unknown[] = [];
    let lines = true;
    for (const [text, show] of REASONS) {
      const line = lineOf(page, text);
      const found = await reach(page, line);
      const said = found
        ? await line.evaluate((n) => ({
            text: n.textContent,
            face: n.querySelectorAll('.av, img, .nhead, .text').length,
            height: Math.round(n.getBoundingClientRect().height),
          }))
        : null;
      seen.push(said);
      lines &&=
        said?.text === `${text}Why${show ? 'Show' : ''}` && said.face === 0 && said.height <= 34;
    }
    fact(
      `${on}: each reason holds the slot with one line of its own words, Show only where allowed`,
      lines,
      seen,
    );
    // Why: inline under the line, naming the muted word, with a touch-sized button that leaves the line's height.
    const word = lineOf(page, 'Has a word you muted.');
    await reach(page, word);
    const why = word.getByRole('button', { name: 'Why' });
    const before = await box(word);
    const touch = await why.evaluate((b) => Math.round(b.getBoundingClientRect().height));
    if (phone) await why.tap();
    else {
      await why.focus();
      await page.keyboard.press('Enter');
    }
    await capture(page, `${size.width}-en-why`);
    const detail = word.locator('.hwhy');
    fact(
      `${on}: Why opens inline by ${phone ? 'touch' : 'keyboard'}, names the matched word, and has touch height`,
      (await why.getAttribute('aria-expanded')) === 'true' &&
        (await detail.isVisible()) &&
        (await detail.innerText()).includes('“spoiler”') &&
        touch >= 32 &&
        before.height <= 34,
      { touch, before },
    );
    // Show in place: the note returns in the same slot, the reading place holds, and Hide puts the line back.
    const person = lineOf(page, 'From someone you muted.');
    await reach(page, person);
    const was = await box(person);
    await person.getByRole('button', { name: 'Show' }).click();
    const shown = page.locator(`${list} .note:has(> .ctx.hshown)`).first();
    await shown.waitFor();
    const now = await box(shown);
    fact(
      `${on}: Show puts the note in its slot with why it was hidden, and the place holds`,
      (await shown.locator('.ctx.hshown').innerText()).startsWith(
        'Shown. From someone you muted.',
      ) &&
        (await shown.locator('.nhead').count()) === 1 &&
        Math.abs(now.top - was.top) <= 2,
      { was, now },
    );
    const shownId = await shown.getAttribute('data-note');
    const saved = await shown.evaluate((node) => {
      const id = (node as HTMLElement).dataset.note;
      const instance = (node as HTMLElement).dataset.instance;
      const state = JSON.parse(localStorage.getItem(`lkjstr:view:${instance}`) ?? '{}');
      return (
        state.reader?.some(
          ([key, value]: [string, { shown?: boolean }]) => key === id && value.shown === true,
        ) === true
      );
    });
    await page.reload();
    await page.waitForSelector('.note');
    const slot = page.locator(`${list} .note[data-key="${shownId}"]`);
    if (!(await slot.count())) await reach(page, slot);
    const back = slot.locator('.ctx.hshown');
    const replayed = await back.waitFor({ timeout: 4500 }).then(
      () => true,
      () => false,
    );
    fact(`${on}: a reload keeps a shown note shown`, saved && replayed, {
      saved,
      replayed,
      slot: await slot.count(),
    });
    if (!replayed) await slot.getByRole('button', { name: 'Show' }).click();
    await back.getByRole('button', { name: 'Hide' }).click();
    await lineOf(page, 'From someone you muted.').waitFor();
    fact(`${on}: Hide puts the line back`, (await back.count()) === 0);
    // The keys pass over the line as over a divider.
    await page.locator(list).evaluate((v) => (v.scrollTop = 0));
    let onLine = 0;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('j');
      onLine += await page.locator(`${list} .list > .sel.hid`).count();
    }
    fact(`${on}: j never stops on a hidden line`, onLine === 0, onLine);
    // A content warning: the row keeps its header and actions; only the body folds, with Hide once shown.
    const cover = warningRow(page);
    await reach(page, cover);
    const warningId = await cover.getAttribute('data-note');
    const cw = page.locator(`${list} .note[data-note="${warningId}"]`);
    const folded = await cw.evaluate((n) => ({
      head: n.querySelectorAll('.nhead').length,
      acts: n.querySelectorAll('.acts').length,
      face: n.querySelectorAll('.nrow > .av').length,
      body: n.querySelectorAll('.nmain .content, .nmain img').length,
    }));
    await capture(page, `${size.width}-en-warning`);
    await cw.locator('.nmain > .cw').click();
    const line = cw.locator('.cwline');
    const opened =
      (await line.innerText()).includes('Hide') && (await cw.locator('.content').count()) === 1;
    await line.getByRole('button', { name: 'Hide' }).click();
    fact(
      `${on}: a content warning folds only the body, nothing drawn behind it, and Hide folds it again`,
      folded.head === 1 &&
        folded.face === 1 &&
        folded.acts === 1 &&
        folded.body === 0 &&
        opened &&
        (await cw.locator('.nmain > .cw').count()) === 1,
      folded,
    );
    // End lines: none where nothing was reported; per cause, with a number only when exact, where it was.
    const quiet = await page.locator(`${list} .fstate .unshown`).count();
    await page.locator(list).evaluate((v) => (v.scrollTop = 0));
    await page.locator(`${list} .note .text button.lnk`, { hasText: '#nostr' }).first().click();
    const tag = page.locator('.view[data-kind="hashtag"]:visible');
    await tag.locator('.fstate .unshown').first().waitFor({ state: 'attached' });
    const ends = await tag.locator('.fstate .unshown').allTextContents();
    fact(
      `${on}: end lines appear only where reported, by cause`,
      quiet === 0 &&
        ends.join('|') ===
          'Dropped 3 relay deliveries that failed signature or content checks.|Some relays did not deliver everything asked for.',
      { quiet, ends },
    );
    await page.context().close();
    if (!warningId) throw new Error('missing content warning fixture');
    const thread = await open(
      `/n/note1${warningId.slice(0, 58)}`,
      {
        mock: { live: false },
        'layout:main': one(['global']),
      },
      size,
      phone,
    );
    const focus = thread.locator('.view[data-kind="thread"] .th-focus');
    await focus.locator('.nmain > .cw').waitFor();
    fact(
      `${on}: a warned thread focus keeps its author and actions while its body is folded`,
      (await focus.locator('.nhead').count()) === 1 &&
        (await focus.locator('.acts').count()) === 1 &&
        (await focus.locator('.nmain .content').count()) === 0,
    );
    await thread.context().close();
  }
  // Why opens the reason's own setting in the same tile, with Japanese labels.
  for (const size of sizes) {
    const phone = size.width === 390;
    const page = await open(
      '/',
      {
        mock: { live: false },
        'layout:main': one(['global']),
        settings: { language: 'ja' },
      },
      size,
      phone,
    );
    const cover = warningRow(page);
    const reached = await reach(page, cover);
    fact(
      `${size.width} ja: localized content warning retains the author and actions`,
      reached &&
        (await cover.locator('.nhead').count()) === 1 &&
        (await cover.locator('.acts').count()) === 1,
    );
    await capture(page, `${size.width}-ja-warning`);
    const person = lineOf(page, 'ミュートした人のノートです。');
    const ja = await reach(page, person);
    const why = person.getByRole('button', { name: '理由' });
    if (phone) await why.tap();
    else await why.click();
    await capture(page, `${size.width}-ja-why`);
    await person.locator('.hwhy button').click();
    const entry = page.locator(
      '.view[data-kind="settings"]:visible [data-entry="set.mute.person"]',
    );
    await entry.waitFor();
    fact(
      `${size.width} ja: Why opens the mute list in the same tile`,
      ja && (await page.locator('.pane').count()) === 1 && (await entry.isVisible()),
    );
    await page.context().close();
  }
}
