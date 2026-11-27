// The finite lists of the mock world: notifications, relays, mutes, media servers, custom emoji, diagnostics.
import type { NotificationRow, Query, Row } from '../protocol.ts';
import { PROTOCOL_VERSION } from '../protocol.ts';
import { actNotifications } from './fixtures-acts.ts';
import { byHandle, byPubkey, byRef, EMOJI, EMOJI_SETS, emojiKey, emojiOfSet } from './people.ts';
import { relays } from './relays.ts';
import { ME, noteExcerpt, noteRow } from './rows.ts';
import type { World } from './world.ts';

const firstLine = (text: string): string => (text.split('\n')[0] ?? '').slice(0, 120);
const MIN = 60_000;

export function notifications(w: World, q: Query): NotificationRow[] {
  const a = (h: string) => byHandle(h).author;
  const own = (tag: string) => {
    const n = w.byId.get(w.tags.get(tag) ?? '');
    return n
      ? { id: n.id, excerpt: noteExcerpt(n), media: n.cw === undefined ? n.media.length : 0 }
      : undefined;
  };
  const noteBy = (handle: string, has: string) => {
    const n = w.notes.find((x) => x.by.handle === handle && x.text.includes(has));
    return n ? noteRow(w, n, { me: ME }) : undefined;
  };
  const at = (min: number): number => w.base - min * MIN;
  const rows: Omit<NotificationRow, 'kind' | 'key'>[] = [
    ...actNotifications(w, q.account ?? ME),
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
  ];
  const muted = (pk: string): boolean =>
    w.state.mutes.some((m) => m.k === 'person' && m.pubkey === pk);
  for (const n of w.notes.slice(0, 200)) {
    const parent = n.re ? w.byId.get(n.re) : undefined;
    if (
      !parent ||
      parent.by.author.pubkey !== q.account ||
      n.by.author.pubkey === q.account ||
      n.at <= w.base
    )
      continue;
    rows.unshift({
      type: 'reply',
      actors: [n.by.author],
      others: 0,
      at: n.at,
      note: noteRow(w, n, { me: q.account ?? '' }),
      unread: true,
    });
  }
  return rows
    .sort((a, b) => b.at - a.at)
    .filter((r) => !q.types?.length || q.types.includes(r.type))
    .filter((r) => !r.actors.every((x) => muted(x.pubkey)))
    .map((r) => ({
      ...r,
      unread: r.at > w.state.notificationSeen,
      kind: 'notification',
      key: `n:${r.type}:${r.at}`,
    }));
}

export function finite(w: World, q: Query): Row[] | undefined {
  switch (q.source) {
    case 'pins':
      return [
        ...(w.state.pins.get(q.pubkey ?? byRef(q.ref ?? '')?.author.pubkey ?? '') ?? []),
      ].flatMap((id) => {
        const note = w.byId.get(id);
        return note
          ? [{ ...noteRow(w, note, { me: q.account ?? '', reposts: false }), pinned: true }]
          : [];
      });
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
        checked: true,
      }));
    case 'emoji':
      if (!w.customEmoji) return [];
      return EMOJI_SETS.flatMap(([set, d, codes]) =>
        codes.map((code) => ({
          kind: 'emoji' as const,
          source: d ? `30030:${ME}:${d}` : `10030:${ME}:`,
          key: emojiKey(d ? `30030:${ME}:${d}` : `10030:${ME}:`, code, emojiOfSet(code, d)),
          set,
          code,
          url: emojiOfSet(code, d),
          ...(d ? { address: `30030:${ME}:${d}` } : {}),
        })),
      );
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
