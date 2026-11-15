// The lists of Settings: who and what is muted, where uploads go, the reader's relays (`settings-relays.ts`) and
// the way to the accounts. Every removal shows at once and can be taken back.

import type { MuteRow, MuteTarget, Row, ServerRow } from '../engine/protocol.ts';
import { hostOf, serverAddress } from '../shared/address.ts';
import { h } from '../shared/h.ts';
import { both, type Key, t } from '../shared/i18n.ts';
import { SERVER_CHOICES } from '../shared/media-servers.ts';
import type { Disposer } from '../shared/signal.ts';
import { failureText } from './can.ts';
import { type Keyed, reconcile, watchList } from './lists.ts';
import { act } from './note-actions.ts';
import { faceButton, nameButton, plainName, toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { type Entry, frame, searchText } from './settings-entry.ts';

type ListName = `set.mute.${MuteTarget['k']}` | 'set.servers' | 'set.relayList' | 'set.accounts';
export const entryOf = (name: ListName, ...body: (HTMLElement | null)[]): Entry => {
  const [group = '', title = ''] = t(name).split(': ');
  const node = frame(
    group,
    title,
    null,
    h('div', { class: 'muted' }, t(`${name}.d`)),
    ...body.filter((b) => b !== null),
  );
  node.dataset.entry = name;
  return { group, text: searchText(both(name), both(`${name}.d`)), node, sync: () => false };
};

/** A list with its empty line. `draw` shows the rows; nothing is said until the engine has answered. */
export function listBox<R extends { readonly key: string }>(
  empty: Key,
  render: (row: R) => HTMLElement,
) {
  const list = h('div', { class: 'slist' });
  const none = h('div', { class: 'muted snone' });
  const cache: Keyed = new Map(); // bound: the rows of this list
  return {
    el: h('div', { class: 'sbox', tabindex: -1 }, list, none),
    draw(rows: readonly R[], loaded: boolean): void {
      reconcile(list, cache, rows, render);
      none.textContent = !loaded ? t('feed.loading') : rows.length ? '' : t(empty);
    },
  };
}
export const removeButton = (what: string, run: () => void): HTMLElement => {
  const label = t('list.remove', { what });
  return h(
    'button',
    { class: 'x', 'data-f': 'remove', title: label, 'aria-label': label, onclick: run },
    '×',
  );
};
/** One field and a button; `add` returns whether the text was taken (the field then empties and keeps the keyboard). */
export function addForm(
  placeholder: string,
  label: string,
  add: (text: string) => boolean,
): HTMLElement {
  const input = h('input', {
    type: 'text',
    placeholder,
    'aria-label': label,
    autocapitalize: 'off',
    autocomplete: 'off',
    spellcheck: 'false',
    oninput: () => input.removeAttribute('aria-invalid'),
  });
  return h(
    'form',
    {
      class: 'addrow',
      onsubmit: (e) => {
        e.preventDefault();
        if (!input.value.trim()) return;
        if (add(input.value.trim())) input.value = '';
        else input.setAttribute('aria-invalid', 'true');
      },
    },
    input,
    h('button', { class: 'btn', type: 'submit' }, t('list.add')),
  );
}

export { SERVER_CHOICES } from '../shared/media-servers.ts';

const PROTOCOLS: Partial<Record<ServerRow['protocol'], string>> = {
  blossom: 'Blossom',
  nip96: 'NIP-96',
};
const muteName = (r: MuteRow): string =>
  r.target.k === 'person'
    ? r.author
      ? plainName(r.author)
      : r.target.pubkey.slice(0, 12)
    : r.target.k === 'word'
      ? r.target.word
      : r.target.k === 'hashtag'
        ? `#${r.target.tag}`
        : (r.excerpt ?? r.target.id.slice(0, 12));

export function listEntries(env: ViewEnv): { entries: Entry[]; dispose: Disposer } {
  const mute = (target: MuteTarget, on: boolean): void =>
    void act(env, (as) => ({ a: 'mute', as, target, on }));
  const muteRow = (r: MuteRow): HTMLElement => {
    const drop = (): void => {
      mute(r.target, false);
      toast(env.layer, t('mute.removed', { what: muteName(r) }), () => mute(r.target, true));
    };
    const { target } = r;
    const what =
      target.k === 'person' && r.author
        ? [faceButton(r.author, env, 'av sm'), nameButton(r.author, env)]
        : target.k === 'thread'
          ? h(
              'button',
              { class: 'lnk clip', onclick: () => env.open('thread', { id: target.id }) },
              r.author ? `${plainName(r.author)}: ${muteName(r)}` : muteName(r),
            )
          : h('span', { class: 'clip' }, muteName(r));
    return h('div', { class: 'srow' }, what, removeButton(muteName(r), drop));
  };
  const kinds = ['person', 'word', 'hashtag', 'thread'] as const;
  const mutes = kinds.map((k) => ({ k, box: listBox<MuteRow>(`mute.none.${k}`, muteRow) }));
  let muted: MuteRow[] = [];
  const has = (target: MuteTarget): boolean =>
    muted.some((m) => JSON.stringify(m.target) === JSON.stringify(target));
  const addMute = (target: MuteTarget): boolean => {
    if (has(target)) return (toast(env.layer, t('list.already')), false);
    mute(target, true);
    return true;
  };
  const forms: Partial<Record<MuteTarget['k'], HTMLElement>> = {
    word: addForm(t('mute.word'), t('mute.word'), (word) => addMute({ k: 'word', word })),
    hashtag: addForm('#', t('mute.hashtag'), (text) => {
      const tag = text.replace(/^[#＃]+/, '');
      return tag !== '' && !/\s/.test(tag) && addMute({ k: 'hashtag', tag });
    }),
  };

  let servers: ServerRow[] = [];
  const saveServers = (list: readonly string[]): void =>
    void act(env, (as) => ({ a: 'servers.save', as, servers: list }));
  const serverRow = (r: ServerRow): HTMLElement => {
    const drop = (): void => {
      const urls = servers.map((s) => s.url);
      const at = urls.indexOf(r.url);
      saveServers(urls.filter((u) => u !== r.url));
      toast(env.layer, t('servers.removed', { host: hostOf(r.url) }), () => {
        const now = servers.map((s) => s.url).filter((u) => u !== r.url);
        now.splice(Math.min(at, now.length), 0, r.url);
        saveServers(now);
      });
    };
    const kind = PROTOCOLS[r.protocol] ?? t('servers.unconfirmed');
    return h(
      'div',
      { class: 'srow' },
      h('span', { class: 'clip', title: r.url }, hostOf(r.url)),
      h(
        'span',
        {
          class: r.checked ? (r.ok ? '' : 'bad') : 'muted',
          'data-state': r.checked ? (r.ok ? 'answering' : 'failed') : 'unknown',
          title: r.error ? failureText(r.error) : undefined,
        },
        r.checked && !r.ok ? t('servers.down') : kind,
      ),
      r.checked && !r.ok
        ? h(
            'button',
            {
              class: 'btn',
              'data-f': 'retry',
              onclick: () => void env.engine.act({ a: 'servers.check', server: r.url }),
            },
            t('compose.retry'),
          )
        : null,
      removeButton(hostOf(r.url), drop),
    );
  };
  const serverBox = listBox<ServerRow>('servers.none', serverRow);
  const serverForm = addForm('https://', t('servers.address'), (text) => {
    const url = serverAddress(text);
    if (!url) return (toast(env.layer, t('servers.invalid')), false);
    if (servers.some((s) => s.url === url)) return (toast(env.layer, t('list.already')), false);
    saveServers([...servers.map((s) => s.url), url]);
    return true;
  });

  // A few servers many people use, one press each; the Blossom ones first, and the first of them goes to the front
  // of the list, where the preferred server stands. Only those not on the list are offered.
  const offers = h('div', { class: 'soffers' });
  const drawOffers = (): void => {
    const have = new Set(servers.map((x) => x.url));
    const rest = SERVER_CHOICES.filter((url) => !have.has(url));
    offers.hidden = rest.length === 0;
    offers.replaceChildren(
      h('span', { class: 'muted' }, t('servers.choices')),
      ...rest.map((url) =>
        h(
          'button',
          {
            class: 'chip',
            'data-server': url,
            onclick: () => {
              const now = servers.map((x) => x.url);
              saveServers(url === SERVER_CHOICES[0] ? [url, ...now] : [...now, url]);
            },
          },
          `+ ${hostOf(url)}`,
        ),
      ),
    );
  };

  const offs = [
    watchList(env, 'mutes', (rows: readonly Row[], loaded) => {
      muted = rows.filter((r): r is MuteRow => r.kind === 'mute');
      for (const m of mutes)
        m.box.draw(
          muted.filter((r) => r.target.k === m.k),
          loaded,
        );
    }),
    watchList(env, 'media-servers', (rows: readonly Row[], loaded) => {
      servers = rows.filter((r): r is ServerRow => r.kind === 'server');
      serverBox.draw(servers, loaded);
      drawOffers();
    }),
  ];
  return {
    entries: [
      entryOf(
        'set.accounts',
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn', onclick: () => env.open('account') }, t('view.account')),
        ),
      ),
      ...mutes.map((m) => entryOf(`set.mute.${m.k}`, m.box.el, forms[m.k] ?? null)),
      entryOf('set.servers', serverBox.el, serverForm, offers),
    ],
    dispose: () => offs.forEach((off) => off()),
  };
}
