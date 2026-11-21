// "via <client>" by a note's time (docs/interface-client.md), on the mock: on the time's line without moving the
// header, bounded relay text, app information on a press (verified for lkjstr, not verified for a bot), keyboard,
// nothing under 340px, and the setting that leaves lkjstr out of one's posts.
import type { Page } from 'playwright-core';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (
  path: string,
  given: Record<string, unknown>,
  size?: { width: number; height: number },
) => Promise<Page>;

const list = '.view[data-kind="global"]:visible';
const one = (tabs: string[]) => ({ type: 'pane', id: 'a', tabs, active: tabs[0] });

/** Where a note's via stands against its time, and its header against a header without one. */
const geometry = (page: Page, text: string) =>
  page.locator(list).evaluate((v, text) => {
    const note = [...v.querySelectorAll('.note')].find((n) =>
      n.querySelector('.nhead > .via')?.textContent?.includes(text),
    );
    const plain = [...v.querySelectorAll('.note')].find((n) => !n.querySelector('.nhead > .via'));
    const via = note?.querySelector('.nhead > .via');
    const time = note?.querySelector('.nhead time');
    if (!note || !via || !time) return null;
    const a = via.getBoundingClientRect();
    const b = time.getBoundingClientRect();
    return {
      shown: getComputedStyle(via).display !== 'none',
      text: via.textContent ?? '',
      label: via.getAttribute('aria-label') ?? '',
      apart: Math.round(b.left - a.right),
      line: Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) < 3,
      head: Math.round(note.querySelector('.nhead')?.getBoundingClientRect().height ?? 0),
      plainHead: Math.round(plain?.querySelector('.nhead')?.getBoundingClientRect().height ?? 0),
    };
  }, text);

export async function viaChecks(open: Open, fact: Check): Promise<void> {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const on = size.width > 600 ? 'desktop' : 'phone';
    const page = await open(
      '/',
      { mock: { live: false }, 'layout:main': one(['global', 'compose', 'settings']) },
      size,
    );
    await page.locator(`${list} .nhead > .via`).first().waitFor();
    const bot = await geometry(page, 'release-bot');
    fact(
      `${on}: via stands on the time's line, apart from it, and the header keeps its height`,
      bot !== null && bot.shown && bot.line && bot.apart >= 0 && bot.head === bot.plainHead,
      bot,
    );
    const hostile = await geometry(page, 'Totally');
    fact(
      `${on}: a hostile client name is plain, bounded text with its whole name in the label`,
      hostile !== null &&
        ![...hostile.text].some((c) => (c.codePointAt(0) ?? 0) < 32 || c === '\u202e') &&
        hostile.text.length <= 52 &&
        hostile.label.startsWith('Written with Totally Official Release Client'),
      hostile,
    );
    // A handler that cannot be verified: its name stays, with the not-verified line; nothing opens.
    const pages = page.context().pages().length;
    const botVia = page.locator(`${list} .nhead > button.via`, { hasText: 'release-bot' }).first();
    await botVia.focus();
    await page.keyboard.press('Enter');
    const info = page.locator('.vinfo');
    await info.locator('.vsaid', { hasText: 'No verified app information' }).waitFor();
    fact(
      `${on}: an unverified handler says so by its name, and nothing navigates`,
      (await info.locator('.vname').textContent()) === 'release-bot' &&
        page.context().pages().length === pages,
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    fact(
      `${on}: Escape closes app information and the keyboard is back on via`,
      (await info.count()) === 0 &&
        (await page.evaluate(() => document.activeElement?.classList.contains('via') === true)),
    );
    // One's own note carries lkjstr, whose handler verifies: its name and its site, a link only to press.
    await page.locator('.tab[data-view="compose"]').click();
    await page.locator('.view[data-kind="compose"]:visible textarea').fill(`via check ${on}`);
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.locator('.tab[data-view="global"]').click();
    const mine = page.locator(`${list} .note`, { hasText: `via check ${on}` }).first();
    await mine.locator('.nhead > button.via').waitFor();
    await mine.locator('.nhead > button.via').click();
    await info.locator('a.lnk').waitFor();
    const link = info.locator('a.lnk');
    fact(
      `${on}: lkjstr's handler shows its verified name and its site, opened only by a press`,
      (await info.locator('.vname').textContent()) === 'lkjstr' &&
        (await link.textContent()) === 'lkjstr.lkjsxc.com' &&
        (await link.getAttribute('rel'))?.includes('noopener') === true &&
        page.context().pages().length === pages,
    );
    await page.keyboard.press('Escape');
    // Leaving lkjstr out: the next post carries no via.
    await page.locator('.tab[data-view="settings"]').click();
    await page.getByRole('checkbox', { name: 'Include lkjstr in my posts', exact: true }).uncheck();
    await page.locator('.tab[data-view="compose"]').click();
    await page.locator('.view[data-kind="compose"]:visible textarea').fill(`no via ${on}`);
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.locator('.tab[data-view="global"]').click();
    const quiet = page.locator(`${list} .note`, { hasText: `no via ${on}` }).first();
    await quiet.waitFor();
    fact(
      `${on}: with lkjstr left out, one's next post has no via`,
      (await quiet.locator('.via').count()) === 0,
    );
    await page.context().close();
  }
  const narrow = await open(
    '/',
    { mock: { live: false }, 'layout:main': one(['global']) },
    { width: 320, height: 700 },
  );
  await narrow.locator(`${list} .note`).first().waitFor();
  const n = await geometry(narrow, 'release-bot');
  fact('320: under 340px of tile there is no via', n === null || n.shown === false, n);
  await narrow.context().close();
}
