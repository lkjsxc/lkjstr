// The Channels tab: the public chats (NIP-28) the reader joined, in their list's order, then the other channels
// the engine knows. One field narrows the list by name, or names a channel by its address; a press opens the
// channel as a tab in the same tile. A joined channel says how much is unread; another offers to be joined.
import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { ChannelRow, Row, SubState } from '../engine/protocol.ts';
import { noteTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { ability } from './can.ts';
import { channelFace, channelForm, channelName, joinButton } from './channel-parts.ts';
import { type Keyed, reconcile } from './lists.ts';
import { how, plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

type Line = ChannelRow | { readonly kind: 'rule'; readonly key: string };

export function mountChannels(el: HTMLElement, env: ViewEnv): () => void {
  const state = loadViewState<{ text?: string }>(env.instance);
  let sub: Subscription | undefined;
  let rows: readonly Row[] = [];
  let appliedText = '';
  let phase: SubState['phase'] = 'cache';
  let account = env.engine.me();
  let can = ability(env.engine);
  const goTo = (c: ChannelRow, e?: MouseEvent): void =>
    env.open('channel', { id: c.id, title: channelName(c) }, e ? how(e) : undefined);
  const render = (c: Line): HTMLElement => {
    if (c.kind === 'rule') return h('div', { class: 'day' }, t('channels.others'));
    const style = { relative: env.settings.get().relativeTime, lang: getLang() };
    const line = c.last
      ? [plainName(c.last.author), c.last.excerpt].filter(Boolean).join(': ')
      : c.about;
    const row = h(
      'div',
      { class: c.unread ? 'chan unread' : 'chan', tabindex: 0, role: 'link', 'data-f': 'open' },
      channelFace(c),
      h(
        'div',
        { class: 'pmain' },
        h('div', { class: 'name clip', title: channelName(c) }, channelName(c)),
        h('div', { class: 'muted clip', title: line || null }, line),
      ),
      c.joined
        ? h(
            'div',
            { class: 'cside' },
            c.last ? h('time', null, noteTime(c.last.at, Date.now(), style)) : null,
            c.unread
              ? h(
                  'span',
                  { class: 'cnew', title: t('channel.unread', { n: c.unread }) },
                  c.unread >= 99 ? '99+' : String(c.unread),
                )
              : null,
          )
        : joinButton(env, c),
    );
    row.addEventListener('click', (e) => {
      if (!(e.target as Element).closest('button')) goTo(c, e);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target === row) e.preventDefault(), goTo(c);
    });
    return row;
  };
  const list = h('div', { class: 'list' });
  const cache: Keyed = new Map(); // bound: the channel rows
  const status = h('div', { class: 'fstate muted' });
  const draw = (): void => {
    const all = rows.filter((r): r is ChannelRow => r.kind === 'channel');
    const first = all.findIndex((c) => !c.joined);
    const lines: Line[] = [...all];
    if (first > 0) lines.splice(first, 0, { kind: 'rule', key: 'rule' });
    reconcile(list, cache, lines, render);
    status.textContent =
      phase === 'failed'
        ? t('feed.failed')
        : all.length
          ? ''
          : phase === 'cache'
            ? t('feed.loading')
            : t('channels.none');
  };
  const open = (): void => {
    sub?.close();
    rows = [];
    phase = 'cache';
    draw();
    appliedText = state.text ?? '';
    const text = appliedText.trim() || undefined;
    sub = env.engine.open(
      { source: 'channels', account: account || undefined, text },
      {
        rows: (r) => ((rows = r), draw()),
        state: (s) => ((phase = s.phase), draw()),
        patch: (ops) => ((rows = applyOps(rows, ops)), draw()),
      },
    );
    sub.window('top', 0, 500);
    sub.visible(env.visible.get());
  };

  const find = h('input', {
    type: 'search',
    value: state.text ?? '',
    placeholder: t('channels.find'),
    'aria-label': t('channels.find'),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  find.addEventListener('input', () => {
    clearTimeout(timer);
    state.text = find.value;
    saveViewState(env.instance, state);
    timer = setTimeout(() => {
      open();
    }, 250);
  });
  find.addEventListener('keydown', (e) => {
    const first = rows.find((r): r is ChannelRow => r.kind === 'channel');
    if (e.key === 'Enter' && !e.isComposing && first && appliedText === find.value) goTo(first);
  });
  const formSlot = h('div');
  const create = h('button', { class: 'btn', 'data-f': 'create' }, t('channel.create'));
  const making = (on: boolean): void => {
    create.hidden = on || can !== 'ok';
    formSlot.replaceChildren(
      ...(on
        ? [
            channelForm(env, undefined, (id) => {
              making(false);
              if (id) env.open('channel', { id });
            }),
          ]
        : []),
    );
  };
  create.addEventListener('click', () => making(true));

  el.classList.add('feed', 'chans');
  el.tabIndex = -1;
  el.replaceChildren(
    h(
      'div',
      { class: 'fslot' },
      h('div', { class: 'fbar' }, h('div', { class: 'rbar' }, find, create), formSlot),
    ),
    list,
    status,
  );
  making(
    loadViewState<{ channelEdit: { open: boolean } }>(env.instance).channelEdit?.open === true,
  );
  open();
  const offs = [
    env.engine.accounts.subscribe((a) => {
      const now = ability(env.engine);
      if ((a.active ?? '') === account && now === can) return;
      account = a.active ?? '';
      can = now;
      cache.clear();
      making(false);
      open();
    }),
    env.visible.subscribe((on) => sub?.visible(on)),
    env.settings.subscribe(() => (cache.clear(), draw())),
  ];
  return () => {
    clearTimeout(timer);
    for (const off of offs) off();
    sub?.close();
  };
}
