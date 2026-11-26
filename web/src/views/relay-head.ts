// The head of a Relay tab: the first row of its list, so it scrolls away with the notes, as a profile's does. It says
// what the relay says about itself (NIP-11) as plain text, how it is connected, and whether it is on the reader's
// list. It changes nothing; the list is edited in Settings.
import type { RelayRow } from '../engine/protocol.ts';
import { hostOf } from '../shared/address.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { copy, nameButton } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { listed } from './relays.ts';

/** "strfry 1.0.4" from "git+https://github.com/hoytech/strfry.git" and "1.0.4"; text that is no address stays. */
export function softwareText(software?: string, version?: string): string {
  const name = software
    ?.replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .split('/')
    .at(-1);
  return [name, version].filter(Boolean).join(' ');
}

/** The connection in words: state, then the relay's own words for an error, then the round trip. */
export function relayState(r: RelayRow): string {
  const out = [t(`relay.${r.state}` as Key)];
  if (r.error && r.state !== 'connected') out.push(r.error);
  if (r.state === 'connected' && r.latencyMs !== undefined) out.push(`${r.latencyMs} ms`);
  return out.join(' · ');
}

export function renderRelayHead(r: RelayRow, env: ViewEnv): HTMLElement {
  const host = hostOf(r.url);
  const named = r.name && r.name !== host ? r.name : '';
  const use = [r.read ? t('relays.read') : '', r.write ? t('relays.write') : '']
    .filter(Boolean)
    .join(' · ');
  const software = softwareText(r.software, r.version);
  const limits = [
    ...(r.limits ?? []).map((l) => t(`relay.limit.${l}` as Key)),
    ...(r.pow ? [t('relay.limit.pow', { n: r.pow })] : []),
  ];
  const about =
    r.info === 'unknown'
      ? h('p', { class: 'about muted' }, t('relay.head.asking'))
      : r.info === 'missing'
        ? h('p', { class: 'about muted' }, t('relay.head.missing'))
        : r.description
          ? h('p', { class: 'about' }, r.description)
          : null;
  return h(
    'div',
    { class: `relayhead s-${r.state}` },
    h(
      'h2',
      { class: 'pname' },
      h('span', { class: 'rdot', title: relayState(r) }),
      h('bdi', null, named || host),
    ),
    h(
      'button',
      {
        class: 'npub',
        title: `${r.url}\n${t('relay.head.copy')}`,
        onclick: () => void copy(env, r.url),
      },
      r.url,
    ),
    about,
    h(
      'div',
      { class: 'pmeta muted' },
      h('span', null, relayState(r)),
      h('span', null, listed(r) ? t('relay.head.yours', { use }) : t('relay.head.notYours')),
      software
        ? h('span', { title: [r.software, r.version].filter(Boolean).join('\n') }, software)
        : null,
    ),
    limits.length
      ? h(
          'div',
          { class: 'rlimits' },
          limits.map((l) => h('span', { class: 'chip' }, l)),
        )
      : null,
    r.admin || r.contact
      ? h(
          'div',
          { class: 'pmeta' },
          r.admin
            ? h(
                'span',
                null,
                h('span', { class: 'muted' }, t('relay.head.admin')),
                nameButton(r.admin, env),
              )
            : null,
          r.contact
            ? h(
                'span',
                { class: 'clip' },
                h('span', { class: 'muted' }, t('relay.head.contact')),
                r.contact,
              )
            : null,
        )
      : null,
    r.nips?.length
      ? h(
          'div',
          { class: 'rnips', title: t('relay.head.nipsHint') },
          `${t('relay.head.nips')} ${r.nips.join(' · ')}`,
        )
      : null,
  );
}
