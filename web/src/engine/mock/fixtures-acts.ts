// Fixed view-model answers for A1/A2. They never change the terminal note's counters.
import type { ActRef, NoteRow, NotificationRow, Query } from '../protocol.ts';
import { byHandle, byPubkey, byRef, EMOJI, SELF } from './people.ts';
import { noteExcerpt } from './rows.ts';
import type { MNote, World } from './world.ts';

const MIN = 60000;
export function actNotifications(w: World, me: string): Omit<NotificationRow, 'kind' | 'key'>[] {
  const n = w.byId.get(w.tags.get('tiles') ?? '');
  if (!n) return [];
  const actor = byPubkey(me)?.author ?? SELF.author;
  const reaction: ActRef = { type: 'reaction', actor, emoji: { emoji: '⭐' } };
  const repost: ActRef = { type: 'repost', actor };
  const target = {
    id: n.id,
    excerpt: noteExcerpt(n),
    media: n.cw === undefined ? n.media.length : 0,
  };
  return [
    {
      type: 'reaction',
      actors: [byHandle('aoi').author, byHandle('kenji').author],
      others: 0,
      at: w.base - 6 * MIN,
      unread: true,
      emoji: { emoji: ':otsu:', url: EMOJI.otsu },
      target: { ...target, act: reaction },
    },
    {
      type: 'reaction',
      actors: [byHandle('sam').author],
      others: 0,
      at: w.base - 7 * MIN,
      unread: true,
      emoji: { emoji: '+' },
      target: { ...target, act: repost },
    },
    {
      type: 'repost',
      actors: [byHandle('lena').author],
      others: 0,
      at: w.base - 9 * MIN,
      unread: true,
      pendingAct: { act: reaction, state: 'loading' },
    },
    {
      type: 'repost',
      actors: [byHandle('taro').author],
      others: 0,
      at: w.base - 10 * MIN,
      unread: true,
      pendingAct: { act: repost, state: 'missing' },
    },
  ];
}

export type ProfileAct = Pick<NoteRow, 'act' | 'actOn' | 'at'>;
export function profileAct(w: World, q: Query, n: MNote): ProfileAct | undefined {
  if (q.source !== 'profile' || (q.show !== 'reactions' && q.show !== 'reposts')) return;
  const person = byHandle('aoi');
  if ((q.pubkey ?? byRef(q.ref ?? '')?.author.pubkey) !== person.author.pubkey) return;
  const index = ['lint', 'restart', 'localfirst'].findIndex((tag) => w.tags.get(tag) === n.id);
  if (index < 0) return;
  const type = q.show === 'reactions' ? 'reaction' : 'repost';
  return {
    at: w.base - (index + 3) * MIN,
    act: { type, actor: person.author, emoji: type === 'reaction' ? { emoji: '+' } : undefined },
    actOn:
      index === 1
        ? { type: 'reaction', actor: byHandle('kenji').author, emoji: { emoji: '⭐' } }
        : index === 2
          ? { type: 'repost', actor: byHandle('lena').author }
          : undefined,
  };
}
