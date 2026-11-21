// Channels of the mock world (NIP-28): the rows, which channel a query means, and the channel actions.
import type { Action, ChannelRow, Failure, FromEngine, Query } from '../protocol.ts';
import type { Core } from './engine.ts';
import { CHANNEL_LIVE } from './fixtures-channels.ts';
import { byHandle, byPubkey, type Person, SELF } from './people.ts';
import type { Entry } from './query.ts';
import { noteExcerpt } from './rows.ts';
import { idOf, type World } from './world.ts';

export type MChannel = {
  readonly id: string;
  name: string;
  about: string;
  picture?: string;
  /** Absent: the creation event has not arrived. */
  readonly by?: Person;
};

const bech32 = (id: string): string => `nevent1${id.slice(0, 58)}`;
const REF = /^((nevent1|note1)[a-z0-9]+|[0-9a-f]{64})$/;
export const channelKey = (id: string): string => `channel:${id}`;

export function channelRow(w: World, c: MChannel, me: string): ChannelRow {
  const said = w.notes.filter((n) => n.channel === c.id && !w.isMuted(n));
  const last = said[0];
  const joined = Boolean(me) && w.state.joined.includes(c.id);
  const seen = w.state.seen.get(c.id) ?? 0;
  const unread = joined ? said.filter((n) => n.at > seen && n.by.author.pubkey !== me).length : 0;
  return {
    kind: 'channel',
    key: channelKey(c.id),
    id: c.id,
    bech32: bech32(c.id),
    name: c.name,
    about: c.about,
    picture: c.picture,
    creator: c.by?.author,
    joined,
    own: Boolean(me) && c.by?.author.pubkey === me,
    last: last ? { at: last.at, author: last.by.author, excerpt: noteExcerpt(last) } : undefined,
    unread: Math.min(99, unread),
  };
}

/** The channel a `channel` query names, by id or by reference; a 64 hex id nobody knows is a channel whose
 * creation event has not arrived. */
export function channelOf(w: World, q: Query): MChannel | undefined {
  const named = q.id ?? q.ref ?? '';
  const known = w.state.channels.find((c) => c.id === named || bech32(c.id) === named);
  if (known || !/^[0-9a-f]{64}$/.test(named)) return known;
  return { id: named, name: '', about: '' };
}

const entryOf = (w: World, c: MChannel, me: string): Entry => ({
  key: channelKey(c.id),
  row: () => channelRow(w, c, me),
});
export const channelHeader = entryOf;

/** The `channels` list: joined first in the list's order, then the others, the latest spoken in first. */
export function channelList(w: World, q: Query, me: string): Entry[] {
  const typed = (q.text ?? '').trim();
  if (REF.test(typed)) {
    const c = channelOf(w, { source: 'channel', ref: typed });
    return c ? [entryOf(w, c, me)] : [];
  }
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
  const lastAt = (c: MChannel): number => w.notes.find((n) => n.channel === c.id)?.at ?? 0;
  const order = (c: MChannel): number => (me ? w.state.joined.indexOf(c.id) : -1);
  return w.state.channels
    .filter((c) => words.every((x) => `${c.name} ${c.about}`.toLowerCase().includes(x)))
    .sort((a, b) => {
      const [ja, jb] = [order(a), order(b)];
      if (ja >= 0 || jb >= 0) return ja >= 0 && jb >= 0 ? ja - jb : ja >= 0 ? -1 : 1;
      return lastAt(b) - lastAt(a);
    })
    .map((c) => entryOf(w, c, me));
}

/** Something about a channel changed (a message, the list, what was seen): its rows go out again. */
export function channelTouched(core: Core, id: string): void {
  core.changed(channelKey(id));
  core.resync((q) => q.source === 'channels', true);
}

type Reply = {
  done(extra?: Partial<Extract<FromEngine, { t: 'result' }>>): void;
  fail(code: Failure['code'], message?: string): void;
  deliver(extra?: { id?: string }): void;
};
type ChannelAction = Extract<Action, { a: 'channel.join' | 'channel.save' | 'channel.seen' }>;

export function channelAct(core: Core, a: ChannelAction, r: Reply): void {
  const { state } = core.world;
  if (a.a === 'channel.seen') {
    state.seen.set(a.id, core.now());
    channelTouched(core, a.id);
    return r.done();
  }
  if (a.a === 'channel.join') {
    state.joined = state.joined.filter((id) => id !== a.id);
    if (a.on) state.joined.push(a.id);
    if (a.on && !state.channels.some((c) => c.id === a.id))
      state.channels.push({ id: a.id, name: '', about: '' });
    channelTouched(core, a.id);
    return r.deliver();
  }
  const name = a.channel.name.trim();
  if (!name) return r.fail('rejected', 'a channel needs a name');
  const edit = { name, about: a.channel.about.trim(), picture: a.channel.picture || undefined };
  if (!a.id) {
    const id = idOf(9500 + state.channels.length);
    state.channels.push({ id, ...edit, by: byPubkey(core.me()) ?? SELF });
    state.joined.push(id);
    state.seen.set(id, core.now());
    channelTouched(core, id);
    return r.deliver({ id });
  }
  const c = state.channels.find((x) => x.id === a.id);
  if (!c) return r.fail('not-found');
  if (c.by?.author.pubkey !== core.me())
    return r.fail('rejected', 'only its creator can edit a channel');
  Object.assign(c, edit);
  channelTouched(core, c.id);
  core.resync((q) => q.source === 'channel', true); // the name is on every message row
  return r.deliver();
}

/** The mock world's own chat: one message in the first channel. */
export function chatter(core: Core, beat: number): void {
  const c = core.world.state.channels[0];
  const [by, text] = CHANNEL_LIVE[beat % CHANNEL_LIVE.length] ?? ['taro', ''];
  if (!c) return;
  core.arrived(core.world.arrive(byHandle(by), text, core.now(), { channel: c.id }));
  channelTouched(core, c.id);
}
