// The head of a channel tab: what the channel is (face, name, about, who made it, its address, join or leave,
// edit for its creator) and, under it, the composer. Lists here read newest first, so the newest end of a chat is
// its top: the composer sits there, right above the latest message, and scrolls away with the head like every
// first row. The head is one standing element that is updated in place (the engine sends the channel row again
// with every message), so what is being typed is never disturbed. While the tab is in front, what arrives is seen.
import type { ChannelRow, Query, Row } from '../engine/protocol.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { ability } from './can.ts';
import { channelFace, channelForm, channelName, joinButton } from './channel-parts.ts';
import { mountCompose } from './compose.ts';
import { copy, nameButton } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export function mountChannelDesk(o: { env: ViewEnv; slot: HTMLElement }): {
  seat(header: HTMLElement | undefined, row: Row | undefined): void;
  query(): Partial<Query>;
  dispose(): void;
} {
  const { env } = o;
  const head = h('div', { class: 'chead' });
  const say = h('div', { class: 'csay' });
  const desk = h('div', { class: 'cdesk', hidden: true }, head, say);
  let shown = '';
  let channel: ChannelRow | undefined;
  let editing = false;
  let closeSay: (() => void) | undefined;
  let marking = false;

  /** The form stands until it is done with, whatever arrives meanwhile; then the head shows the channel as it
   * is by then. */
  const edit = (c: ChannelRow): void => {
    editing = true;
    shown = '';
    const done = (): void => {
      editing = false;
      if (channel) draw(channel);
    };
    replaceChildren(head, channelForm(env, c, done));
  };
  const draw = (c: ChannelRow): void => {
    const sig = JSON.stringify([c, ability(env.engine)]);
    if (editing || sig === shown) return;
    shown = sig;
    replaceChildren(
      head,
      channelFace(c, 'av lg'),
      h(
        'div',
        { class: 'pmain' },
        h('h2', { class: 'pname' }, channelName(c)),
        c.about ? h('div', { class: 'about' }, c.about) : null,
        h(
          'div',
          { class: 'pmeta muted' },
          c.creator ? h('span', null, nameButton(c.creator, env, 'name quiet')) : null,
          h(
            'button',
            { class: 'npub', title: t('channel.copy'), onclick: () => void copy(env, c.bech32) },
            `${c.bech32.slice(0, 16)}…${c.bech32.slice(-6)}`,
          ),
        ),
      ),
      h(
        'div',
        { class: 'pbtns' },
        c.own
          ? h(
              'button',
              { class: 'btn', 'data-f': 'edit', onclick: () => edit(c) },
              t('channel.edit'),
            )
          : null,
        joinButton(env, c),
      ),
    );
  };
  /** The reader is looking at the channel: what arrived counts as seen. One request at a time. */
  const seen = async (c: ChannelRow): Promise<void> => {
    if (marking || !c.unread || !env.visible.get() || !env.engine.me()) return;
    marking = true;
    await env.engine.act({ a: 'channel.seen', as: env.engine.me(), id: c.id });
    marking = false;
  };
  const offs = [
    env.visible.subscribe((on) => on && channel && void seen(channel)),
    env.engine.accounts.subscribe(() => channel && draw(channel)),
  ];
  o.slot.append(desk);
  return {
    seat(_header, row) {
      if (row?.kind !== 'channel') return;
      channel = row;
      desk.hidden = false;
      draw(row);
      void seen(row);
      if (closeSay) return;
      // The composer keeps its draft under the tab's own name, so it comes back with the tab.
      closeSay = mountCompose(say, { ...env, instance: `${env.instance}:say` }, row.id);
    },
    query: () => ({}),
    dispose() {
      for (const off of offs) off();
      closeSay?.();
    },
  };
}
