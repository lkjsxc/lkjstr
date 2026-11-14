// The finite lists of the mock world: notifications, relays, mutes, media servers, custom emoji, diagnostics.
import type { NotificationRow, Query, Row } from '../protocol.ts';
import { PROTOCOL_VERSION } from '../protocol.ts';
import { byHandle, byPubkey, EMOJI } from './people.ts';
import { relays } from './relays.ts';
import { ME, noteRow } from './rows.ts';
import type { World } from './world.ts';

const firstLine = (text: string): string => (text.split('\n')[0] ?? '').slice(0, 120);
const MIN = 60_000;

export function notifications(w: World, q: Query): NotificationRow[] {
  const a = (h: string) => byHandle(h).author;
  const own = (tag: string) => {
    const n = w.byId.get(w.tags.get(tag) ?? '');
    return n ? { id: n.id, excerpt: firstLine(n.text), media: n.media.length } : undefined;
  };
  const noteBy = (handle: string, has: string) => {
    const n = w.notes.find((x) => x.by.handle === handle && x.text.includes(has));
    return n ? noteRow(w, n, { me: ME }) : undefined;
  };
  const at = (min: number): number => w.base - min * MIN;
  const rows: Omit<NotificationRow, 'kind' | 'key'>[] = [
    {
      type: 'reaction',
      actors: [a('aoi'), a('kenji'), a('sakura')],
      others: 4,
      at: at(8),
      emoji: { emoji: '❤️' },
      target: own('tiles'),
      unread: true,
    },
    {
      type: 'mention',
      actors: [a('sam')],
      others: 0,
      at: at(45),
      note: noteBy('sam', 'bug report'),
      unread: true,
    },
    {
      type: 'zap',
      actors: [a('taro')],
      others: 0,
      at: at(52),
      sats: 2100,
      comment: 'いつも読んでます',
      target: own('tiles'),
      unread: true,
    },
    {
      type: 'repost',
      actors: [a('aoi'), a('taro')],
      others: 0,
      at: at(63),
      target: own('tiles'),
      unread: false,
    },
    {
      type: 'reply',
      actors: [a('aoi')],
      others: 0,
      at: at(70),
      note: noteBy('aoi', 'わかります'),
      unread: false,
    },
    {
      type: 'reaction',
      actors: [a('kenji'), a('yuki')],
      others: 0,
      at: at(72),
      emoji: { emoji: ':otsu:', url: EMOJI.otsu },
      target: own('tiles'),
      unread: false,
    },
    { type: 'follow', actors: [a('priya'), a('hiroshi')], others: 0, at: at(190), unread: false },
    {
      type: 'reaction',
      actors: [a('lena')],
      others: 3,
      at: at(400),
      emoji: { emoji: '❤️' },
      target: own('quiet'),
      unread: false,
    },
    {
      type: 'zap',
      actors: [a('ada')],
      others: 0,
      at: at(880),
      sats: 500,
      target: own('quiet'),
      unread: false,
    },
    { type: 'follow', actors: [a('marco')], others: 0, at: at(1900), unread: false },
  ];
  const muted = (pk: string): boolean =>
    w.state.mutes.some((m) => m.k === 'person' && m.pubkey === pk);
  return rows
    .filter((r) => !q.types?.length || q.types.includes(r.type))
    .filter((r) => !r.actors.every((x) => muted(x.pubkey)))
    .map((r, i) => ({ ...r, kind: 'notification', key: `n:${r.type}:${r.at}:${i}` }));
}

export function finite(w: World, q: Query): Row[] | undefined {
  switch (q.source) {
    case 'notifications':
      return notifications(w, q);
    case 'relays':
      return relays(w);
    case 'mutes':
      return w.state.mutes.map((target) => {
        const key = `mute:${target.k}:${'pubkey' in target ? target.pubkey : 'word' in target ? target.word : 'tag' in target ? target.tag : target.id}`;
        const thread = target.k === 'thread' ? w.byId.get(target.id) : undefined;
        return {
          kind: 'mute',
          key,
          target,
          author: target.k === 'person' ? byPubkey(target.pubkey)?.author : thread?.by.author,
          excerpt: thread ? firstLine(thread.text) : undefined,
        };
      });
    case 'media-servers':
      return w.state.servers.map((url, i) => ({
        kind: 'server',
        key: url,
        url,
        protocol: i ? 'blossom' : 'nip96',
        ok: true,
      }));
    case 'emoji':
      return Object.entries(EMOJI).map(([code, url], i) => ({
        kind: 'emoji',
        key: code,
        set: i < 3 ? '' : 'ことば',
        code,
        url,
      }));
    case 'diagnostics':
      return [
        { kind: 'info', key: 'engine', label: 'engine', value: 'mock' },
        { kind: 'info', key: 'protocol', label: 'protocol', value: String(PROTOCOL_VERSION) },
        { kind: 'info', key: 'events', label: 'events', value: String(w.notes.length) },
      ];
    default:
      return undefined;
  }
}
