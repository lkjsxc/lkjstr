import type { Subscription } from '../engine/client.ts';
import type { Author, Mention, Row } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { avatar, plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

type State = { mentions?: Mention[]; replyTo?: string };
export function createMentions(
  area: HTMLTextAreaElement,
  env: ViewEnv,
  state: State,
  save: () => void,
) {
  const el = h('div', { class: 'cinput' }, area);
  const menu = h('div', { class: 'mention-menu', role: 'listbox', hidden: true });
  const preview = h('div', { class: 'mention-preview muted' });
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
  let lookup = false;
  let sub: Subscription | undefined;
  const pasted = new Map<string, { sub: Subscription; author?: Author }>(); // bound: 32 current addresses
  const hide = (): void => {
    menu.hidden = true;
    sub?.close();
    sub = undefined;
    request = '';
  };
  const position = (): void => {
    const css = getComputedStyle(area);
    const marker = h('span', null, '\u200b');
    const mirror = h(
      'div',
      {
        style: `position:absolute;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${area.clientWidth}px;font:${css.font};line-height:${css.lineHeight};padding:${css.padding}`,
      },
      area.value.slice(0, area.selectionStart),
      marker,
    );
    el.append(mirror);
    menu.style.top = `${Math.max(0, marker.offsetTop - area.scrollTop) + (Number.parseFloat(css.lineHeight) || 24)}px`;
    menu.style.left = `${Math.max(0, Math.min(marker.offsetLeft, area.clientWidth - 300))}px`;
    mirror.remove();
    const tile = area.closest('.view')?.getBoundingClientRect();
    const room = (tile?.bottom ?? innerHeight) - menu.getBoundingClientRect().top - 8;
    menu.style.maxHeight = `${Math.max(44, Math.min(264, room))}px`;
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
    lookup = !candidates.length && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(needle);
    at = Math.min(at, Math.max(0, candidates.length + Number(lookup) - 1));
    draw();
  };
  const resolve = (): void => {
    sub?.close();
    lookup = false;
    sub = env.engine.open(
      { source: 'people', ref: needle },
      { rows, patch: () => sub?.window('top', 0, 6) },
    );
    sub.window('top', 0, 6);
    sub.visible(true);
  };
  const draw = (): void => {
    menu.replaceChildren(
      ...candidates.map((author, i) =>
        h(
          'button',
          {
            class: i === at ? 'on' : '',
            role: 'option',
            'aria-selected': i === at,
            tabindex: -1,
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => take(author),
          },
          avatar(author, 'av sm'),
          h(
            'span',
            { class: 'clip' },
            h('b', null, plainName(author)),
            h('small', { class: 'muted' }, author.nip05 ?? ''),
          ),
        ),
      ),
      ...(lookup
        ? [
            h(
              'button',
              {
                class: at === candidates.length ? 'on' : '',
                role: 'option',
                'aria-selected': at === candidates.length,
                onpointerdown: (e) => e.preventDefault(),
                onclick: resolve,
              },
              t('mention.lookup', { name: needle }),
            ),
          ]
        : []),
    );
    menu.hidden = composing || (!candidates.length && !lookup);
    if (!menu.hidden) position();
  };
  const drawPreview = (): void => {
    preview.replaceChildren(
      ...(state.mentions ?? []).map((m) => h('span', null, m.label)),
      ...[...pasted.values()].flatMap((p) =>
        p.author ? [h('span', null, `@${plainName(p.author)}`)] : [],
      ),
    );
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
    const found = /(?:^|[\s(])@([^\s@]+(?:@[^\s@]*)?)$/u.exec(before);
    if (!found || !/^[\p{L}\p{N}]/u.test(found[1] ?? '')) return hide();
    needle = found[1] ?? '';
    end = area.selectionStart;
    start = end - needle.length - 1;
    const key = `${start}:${needle}`;
    if (key === request) return;
    hide();
    request = key;
    at = 0;
    sub = env.engine.open(
      { source: 'people', text: needle, account: env.engine.me() || undefined, id: state.replyTo },
      { rows, patch: () => sub?.window('top', 0, 6) },
    );
    sub.window('top', 0, 6);
    sub.visible(true);
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
    const count = candidates.length + Number(lookup);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closed = area.value;
      hide();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
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
