// "via <client>" by a note's time (docs/interface-client.md): the NIP-89 client tag's name, which is relay input, drawn
// as text, short and quiet; with a handler address it is a button whose press asks the engine once for verified app
// information and shows it in a small popover. Nothing navigates by itself.
import type { NoteRow } from '../engine/protocol.ts';
import { type Child, h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { openPopover } from '../wm/menus.ts';
import type { ViewEnv } from './registry.ts';
import { momentTime } from './their-home.ts';

const SHOWN = 48; // characters drawn; CSS cuts further to fit
const KEPT = 128; // characters in the tooltip and the accessible name

/** The first `n` characters as a reader sees them: an emoji, even one joined from several, is never cut in two. */
function first(text: string, n: number): string {
  const seg = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : undefined;
  const parts = seg ? [...seg.segment(text)].map((s) => s.segment) : [...text];
  return parts.length > n ? parts.slice(0, n).join('') : text;
}
const length = (text: string): number =>
  typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter().segment(text)].length
    : [...text].length;

/** Relay text made safe to show: no control or format characters, whitespace collapsed, bounded. Pure, tested. */
export const clientName = (raw: string): string =>
  first(
    raw
      .replace(/(?!\u200d)[\p{Cc}\p{Cf}]/gu, '') // the joiner stays: it holds joined emoji together
      .replace(/\s+/gu, ' ')
      .trim(),
    KEPT,
  );

/** A website a reader may be offered: http or https only, shown by its host. */
export function safeSite(raw: string | undefined): URL | undefined {
  try {
    const url = new URL(raw ?? '');
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

function appInfo(env: ViewEnv, anchor: HTMLElement, name: string, address: string): void {
  const said = h('div', { class: 'vsaid', role: 'status' }, t('feed.loading'));
  const panel = h('div', { class: 'menu vinfo' }, h('div', { class: 'vname' }, name), said);
  openPopover(env.layer, anchor, panel);
  void env.engine.act({ a: 'client.info', address }).then((r) => {
    const info = r.ok ? r.clientInfo : undefined;
    const site = safeSite(info?.website);
    if (!info) return void said.replaceChildren(t('client.unverified'));
    panel.firstElementChild?.replaceChildren(clientName(info.name) || name);
    said.replaceChildren(
      site
        ? h(
            'a',
            { class: 'lnk', href: site.href, target: '_blank', rel: 'noopener noreferrer' },
            site.host,
          )
        : '',
    );
  });
}

/** The end of a note's header: "via <client>" when tagged, then the time. */
export function stamp(row: NoteRow, env: ViewEnv, shownTime: Child): Child[] {
  const time = momentTime(row, env, shownTime);
  const name = row.client && !row.pending ? clientName(row.client) : '';
  if (!name) return [time];
  const shown = length(name) > SHOWN ? `${first(name, SHOWN - 1)}…` : name;
  const label = t('note.viaLabel', { name });
  const text = t('note.via', { name: shown });
  // The engine sends an address only when it is a well-formed kind-31990 coordinate.
  const address = row.clientAddress ?? '';
  const via = address
    ? h('button', { class: 'via', title: label, 'aria-label': label }, text)
    : h('span', { class: 'via', title: label, 'aria-label': label }, text);
  if (address)
    via.addEventListener('click', (e) => (e.stopPropagation(), appInfo(env, via, name, address)));
  return [via, time];
}
