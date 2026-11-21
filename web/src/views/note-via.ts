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
const ADDRESS = /^31990:[0-9a-f]{64}:[^\s]{1,128}$/;

/** Relay text made safe to show: no control or format characters, whitespace collapsed, bounded. Pure, tested. */
export const clientName = (raw: string): string =>
  raw
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, KEPT);

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
  const shown = name.length > SHOWN ? `${name.slice(0, SHOWN - 1)}…` : name;
  const label = t('note.viaLabel', { name });
  const text = t('note.via', { name: shown });
  const address = row.clientAddress && ADDRESS.test(row.clientAddress) ? row.clientAddress : '';
  const via = address
    ? h('button', { class: 'via', title: label, 'aria-label': label }, text)
    : h('span', { class: 'via', title: label, 'aria-label': label }, text);
  if (address)
    via.addEventListener('click', (e) => (e.stopPropagation(), appInfo(env, via, name, address)));
  return [via, time];
}
