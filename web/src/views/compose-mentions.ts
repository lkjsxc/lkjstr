// @mentions in a composer: a bare @ offers the people the reader follows and the thread's people, a name, NIP-05
// address or npub narrows or finds one, the keyboard or a tap chooses, and chips under the field name who the note
// will mention. Every composer (Post, the field under a thread's focus, Quote, a channel) mounts this one picker.
import type { Subscription } from '../engine/client.ts';
import type { Author, Mention, Query, Row } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import {
  chip,
  lookupOption,
  option,
  placeMenu,
  type Quiet,
  quietLine,
} from './compose-mention-menu.ts';
import { plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

type State = { mentions?: Mention[]; replyTo?: string; quote?: string };
const ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PERSON_REF = /^(?:nostr:)?(?:npub1|nprofile1)[a-z0-9]{20,}$/i;
const fold = (s: string): string => s.normalize('NFKC').toLowerCase();
export function createMentions(
  area: HTMLTextAreaElement,
  env: ViewEnv,
  state: State,
  save: () => void,
) {
  const el = h('div', { class: 'cinput' }, area);
  const menu = h('div', { class: 'mention-menu', role: 'listbox', hidden: true });
  const preview = h('div', { class: 'mention-preview', 'aria-label': t('mention.chips') });
  el.append(menu);
  let previous = area.value;
  let composing = false;
  let closed = '';
  let request = '';
  let at = 0;
  let start = 0;
  let end = 0;
  let needle = '';
  let candidates: Author[] = [];
  let answered = false;
  let looking = false;
  let sub: Subscription | undefined;
  const faces = new Map<string, Author>(); // bound: 32 chosen people, for their chips
  const pasted = new Map<string, { sub: Subscription; author?: Author }>(); // bound: 32 current addresses
  const lookup = (): boolean => !candidates.length && !looking && ADDRESS.test(needle);
  const choices = (): number => candidates.length + Number(lookup());
  const release = (): void => {
    sub?.close();
    sub = undefined;
  };
  const hide = (): void => {
    menu.hidden = true;
    release();
    request = '';
    candidates = [];
    answered = looking = false;
  };
  const take = (author: Author): void => {
    const label = `@${plainName(author)}`;
    area.setRangeText(`${label} `, start, end, 'end');
    adjust();
    (state.mentions ??= []).push({
      start,
      end: start + label.length,
      label,
      pubkey: author.pubkey,
    });
    if (faces.size >= 32) faces.delete(faces.keys().next().value ?? '');
    faces.set(author.pubkey, author);
    previous = area.value;
    closed = area.value;
    hide();
    save();
    drawPreview();
    area.dispatchEvent(new Event('input'));
    area.focus({ preventScroll: true });
  };
  const rows = (values: readonly Row[]): void => {
    candidates = values
      .filter((r) => r.kind === 'person')
      .map((r) => r.author)
      .slice(0, 6);
    answered = true;
    if (candidates.length) looking = false;
    at = Math.min(at, Math.max(0, choices() - 1));
    draw();
  };
  const ask = (query: Query): void => {
    release();
    const opened = env.engine.open(query, { rows, patch: () => opened.window('top', 0, 6) });
    sub = opened;
    opened.window('top', 0, 6);
    opened.visible(true);
  };
  const resolve = (): void => {
    looking = true;
    draw();
    ask({ source: 'people', ref: needle });
  };
  const quiet = (): Quiet | undefined =>
    looking ? 'looking' : !needle ? 'hint' : lookup() ? undefined : 'none';
  const draw = (): void => {
    const why = candidates.length || !answered ? undefined : quiet();
    menu.replaceChildren(
      ...candidates.map((author, i) => option(author, i === at, () => take(author))),
      ...(answered && lookup() ? [lookupOption(needle, at === candidates.length, resolve)] : []),
      ...(why ? [quietLine(why, needle)] : []),
    );
    menu.hidden = composing || !menu.childElementCount;
    if (!menu.hidden) placeMenu(menu, area, el);
  };
  // One chip per person, whether chosen from the menu or pasted as an address.
  const drawPreview = (): void => {
    const people = new Map<string, HTMLElement>();
    for (const m of state.mentions ?? [])
      if (!people.has(m.pubkey)) people.set(m.pubkey, chip(m.label, faces.get(m.pubkey)));
    for (const { author } of pasted.values())
      if (author && !people.has(author.pubkey))
        people.set(author.pubkey, chip(`@${plainName(author)}`, author));
    preview.replaceChildren(...people.values());
  };
  const releasePasted = (): void => {
    for (const item of pasted.values()) item.sub.close();
    pasted.clear();
  };
  const scanPasted = (): void => {
    if (!env.visible.get()) return;
    const refs = new Set(
      [...area.value.matchAll(/(?:nostr:)?(?:npub1|nprofile1)[a-z0-9]+/gi)]
        .slice(0, 32)
        .map((m) => m[0]),
    );
    for (const [ref, item] of pasted)
      if (!refs.has(ref)) {
        item.sub.close();
        pasted.delete(ref);
      }
    for (const ref of refs) {
      if (pasted.has(ref)) continue;
      const show = (rows: readonly Row[]): void => {
        const row = rows[0];
        const item = pasted.get(ref);
        if (item && row && 'author' in row && row.author) {
          item.author = row.author;
          drawPreview();
        }
      };
      const subscription = env.engine.open(
        { source: 'people', ref },
        { rows: show, patch: () => subscription.window('top', 0, 1) },
      );
      pasted.set(ref, { sub: subscription });
      subscription.window('top', 0, 1);
      subscription.visible(true);
    }
    drawPreview();
  };
  const suggest = (): void => {
    if (
      !env.visible.get() ||
      composing ||
      (env.engine.info?.get()?.version ?? 0) < 5 ||
      area.value === closed
    )
      return hide();
    const before = area.value.slice(0, area.selectionStart);
    const found = /(?:^|[\s(])@([^\s@]*(?:@[^\s@]*)?)$/u.exec(before);
    const typed = found?.[1] ?? '';
    if (!found || (typed && !/^[\p{L}\p{N}]/u.test(typed))) return hide();
    end = area.selectionStart;
    start = end - typed.length - 1;
    const key = `${start}:${typed}`;
    if (key === request) return;
    // Until the new answer arrives the menu keeps the choices that still fit what is typed, so it does not blink and a
    // quick Enter cannot take someone the name has already ruled out.
    const fits = fold(typed);
    candidates = PERSON_REF.test(typed)
      ? []
      : candidates.filter((a) =>
          [plainName(a), a.nip05 ?? ''].some((v) => fold(v).startsWith(fits)),
        );
    at = 0;
    request = key;
    needle = typed;
    answered = looking = false;
    draw();
    ask(
      PERSON_REF.test(typed)
        ? { source: 'people', ref: typed }
        : {
            source: 'people',
            text: typed,
            account: env.engine.me() || undefined,
            id: state.replyTo ?? state.quote,
          },
    );
  };
  // An edit crossing a selected name dissolves that mention; edits elsewhere move the range with the text.
  const adjust = (): void => {
    const next = area.value;
    let from = 0;
    while (from < previous.length && from < next.length && previous[from] === next[from]) from++;
    let oldEnd = previous.length,
      newEnd = next.length;
    while (oldEnd > from && newEnd > from && previous[oldEnd - 1] === next[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    const shift = newEnd - oldEnd;
    state.mentions = (state.mentions ?? [])
      .flatMap((m) => {
        if (oldEnd <= m.start) return [{ ...m, start: m.start + shift, end: m.end + shift }];
        if (from >= m.end && !(from === m.end && /\S/.test(next.slice(from, newEnd)))) return [m];
        return [];
      })
      .filter((m) => next.slice(m.start, m.end) === m.label);
    previous = next;
  };
  const input = (): void => {
    closed = '';
    adjust();
    save();
    scanPasted();
    suggest();
  };
  const key = (e: KeyboardEvent): void => {
    if (composing || e.isComposing || e.keyCode === 229 || menu.hidden || e.ctrlKey || e.metaKey)
      return;
    const count = choices();
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closed = area.value;
      hide();
    } else if (!count) return;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      at = (at + (e.key === 'ArrowDown' ? 1 : -1) + count) % count;
      draw();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const who = candidates[at];
      if (who) take(who);
      else resolve();
    }
  };
  const outside = (e: Event): void => {
    if (!el.contains(e.target as Node)) {
      closed = area.value;
      hide();
    }
  };
  const begin = (): void => {
    composing = true;
    hide();
  };
  const finish = (): void => {
    composing = false;
    input();
  };
  area.addEventListener('input', input);
  area.addEventListener('keydown', key);
  area.addEventListener('click', suggest);
  area.addEventListener('compositionstart', begin);
  area.addEventListener('compositionend', finish);
  document.addEventListener('pointerdown', outside);
  const offVisible = env.visible.subscribe((on) => {
    if (on) {
      scanPasted();
      suggest();
    } else {
      hide();
      releasePasted();
    }
  });
  scanPasted();
  return {
    el,
    preview,
    reset() {
      previous = area.value;
      closed = '';
      hide();
      scanPasted();
    },
    dispose() {
      hide();
      offVisible();
      releasePasted();
      document.removeEventListener('pointerdown', outside);
    },
  };
}
