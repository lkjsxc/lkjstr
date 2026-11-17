// Use only existing launcher, profile controls and scrolling; no product test API.
import { bech32 } from '../web/scripts/smoke-visitors.mjs';
import { delay } from './real-hour-public.mjs';
import { publicIdentity } from './race-report.mjs';
import { visitKinds } from './cache-repeat-model.mjs';
const view = kind => '.pane.cur .view[data-kind="' + kind + '"]:visible';
export async function launcher(page) {
  for (let i = 0; i < 16; i++) {
    const count = await page.locator('.pane.cur .tab').count();
    if (count === 1 && await page.locator(view('new')).count()) return;
    await page.locator('.pane.cur .tab.active > .x').click({ timeout: 5000 });
  }
  throw Error('Fresh owned layout did not return to its existing New tab surface');
}
async function card(page, text) {
  await launcher(page);
  await page.locator(view('new') + ' input[type="search"]').fill(text);
  const result = page.locator(view('new') + ' .ncard').first();
  await result.waitFor({ timeout: 5000 });
  return result;
}
async function clickMeasured(locator, visit) {
  return locator.evaluate((node, visit) => {
    const mark = globalThis.__cacheRepeat.begin(visit);
    node.click();
    return mark;
  }, visit);
}
export async function openVisit(page, step, target, expected) {
  const visit = { id: step.id, kind: step.kind, expected };
  if (step.kind === 'thread' && !target.note) return { unavailable: 'No verified Home note was rendered for a repeated thread target' };
  if (['following', 'followers'].includes(step.kind)) {
    await (await card(page, target.npub)).click();
    const buttons = page.locator(view('profile') + ' .pstats button.stat');
    await buttons.first().waitFor({ timeout: 15000 });
    return clickMeasured(buttons.nth(step.kind === 'following' ? 0 : 1), visit);
  }
  const text = step.kind === 'thread' ? bech32('note', target.note)
    : step.kind === 'profile' ? target.npub : step.kind;
  const choice = await card(page, text);
  if (step.kind !== 'search') return clickMeasured(choice, visit);
  await choice.click();
  const input = page.locator(view('search') + ' input[type="search"]').first();
  await input.waitFor({ timeout: 5000 });
  // Paste and Enter occur in one turn, so the 250ms typing debounce cannot pre-warm this measurement.
  return input.evaluate((node, { visit, text }) => {
    const mark = globalThis.__cacheRepeat.begin(visit);
    node.value = text; node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return mark;
  }, { visit, text: target.search });
}
export async function discoverTarget(page, account, search) {
  const candidates = await page.evaluate(() => [...document.querySelectorAll('.view[data-kind="home"] .note[data-note]')]
    .slice(0, 12).map(note => ({ id: note.dataset.note, author: note.querySelector('[data-face]')?.dataset.face })));
  const notes = candidates.filter(note => /^[0-9a-f]{64}$/.test(note.id) && /^[0-9a-f]{64}$/.test(note.author ?? ''));
  return { account, notes, search, selection: 'Up to 12 verified rendered Home notes and their public authors, frozen for both phases' };
}
export function targetFor(step, seed) {
  const cycle = Math.floor(Number(step.id.slice(6)) / visitKinds.length);
  const note = seed.notes[cycle % seed.notes.length];
  const account = note && ['profile', 'following', 'followers'].includes(step.kind)
    ? publicIdentity(note.author) : seed.account;
  const target = { ...account, note: note?.id, search: seed.search };
  target.key = step.kind + ':' + (step.kind === 'thread' ? target.note ?? 'unavailable'
    : step.kind === 'search' ? seed.search : account.pubkey);
  return target;
}
export async function dwell(page, step, startedAt, stopped, deadline) {
  const end = deadline ?? startedAt + step.dwellSeconds * 1000;
  const slotStart = end - step.dwellSeconds * 1000;
  let down = false, back = false, original, missed = false;
  while (Date.now() < end && !stopped()) {
    const elapsed = (Date.now() - slotStart) / 1000;
    if (step.scroll && !down && elapsed >= step.dwellSeconds / 3) {
      original = await page.evaluate(kind => {
        const el = [...document.querySelectorAll('.view')].find(view => view.dataset.kind === kind && view.getClientRects().length);
        if (!el) return null;
        const top = el.scrollTop; el.scrollTop = top + el.clientHeight * 0.75;
        el.dispatchEvent(new Event('scroll')); return top;
      }, step.kind);
      down = true; missed = original === null;
    }
    if (down && !back && elapsed >= step.dwellSeconds * 2 / 3) {
      if (original !== null) await page.evaluate(({ kind, top }) => {
        const el = [...document.querySelectorAll('.view')].find(view => view.dataset.kind === kind && view.getClientRects().length);
        if (el) { el.scrollTop = top; el.dispatchEvent(new Event('scroll')); }
      }, { kind: step.kind, top: original });
      back = true;
    }
    await delay(Math.max(1, Math.min(250, end - Date.now())));
  }
  return { down, returned: back, missed, initialTop: original };
}
export async function reloadVisit(page, visit, known) {
  await page.evaluate(({ visit, known }) => {
    sessionStorage.setItem('lkjstr-measure:cache-repeat-next', JSON.stringify({ visit, known }));
  }, { visit, known });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
}
