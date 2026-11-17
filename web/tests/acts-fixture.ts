import { vi } from 'vitest';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { ActRef, Author, NoteRow, NotificationRow } from '../src/engine/protocol.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import type { ViewEnv } from '../src/views/registry.ts';

export const person = (name: string, hex: string): Author => ({
  pubkey: hex.repeat(64),
  npub: `npub1${name.toLowerCase()}`,
  name,
});
export const reader = person('Reader', 'a');
export const actor = person('Alice', 'b');
export const other = person('Bob', 'c');
export const targetAct = (type: ActRef['type'] = 'reaction'): ActRef => ({
  type,
  actor: reader,
  emoji: type === 'reaction' ? { emoji: '⭐' } : undefined,
});
export function setup() {
  const open = vi.fn();
  const env = {
    instance: 'acts-test',
    params: {},
    layer: document.createElement('div'),
    settings: createSettings(),
    open,
    engine: {
      me: () => '',
      accounts: createSignal({ accounts: [] }),
      info: createSignal({ engine: 'mock', version: 14 }),
    },
  } as unknown as ViewEnv;
  return { env, open };
}
export function notification(): NotificationRow {
  return {
    kind: 'notification',
    key: 'target-act-group',
    type: 'reaction',
    at: 1794000000000,
    actors: [actor, other],
    others: 0,
    unread: true,
    emoji: { emoji: ':otsu:', url: '/fixture-emoji.svg' },
    target: { id: 'd'.repeat(64), excerpt: 'The terminal note.', media: 0, act: targetAct() },
  };
}
export function note(): NoteRow {
  const w = createWorld(1794000000000);
  const n = w.notes[0];
  if (!n) throw new Error('fixture note missing');
  return {
    ...noteRow(w, n, { me: '' }),
    hidden: undefined,
    cw: undefined,
    segments: [{ k: 'text', text: 'The terminal note.' }],
    media: [],
    quotes: [],
    repostedBy: undefined,
    replyTo: undefined,
    previews: undefined,
    act: { type: 'reaction', actor, emoji: { emoji: '+' } },
    actOn: { type: 'repost', actor: reader },
  };
}
