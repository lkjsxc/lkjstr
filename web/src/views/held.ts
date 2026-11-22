// A like or a repost is public the moment it is sent, so it is not sent at once: the row shows it immediately and
// the publish waits here for as long as its Undo is offered. Undo within that time means it was never sent. Nothing
// is lost by leaving: whatever still waits goes out when the page is hidden or closed.
import type { ActResult } from '../engine/client.ts';
import type { Action, NoteRow, Pubkey } from '../engine/protocol.ts';

export const UNDO_MS = 8000;

export type HeldWhat =
  | { readonly k: 'repost' }
  | {
      readonly k: 'reaction';
      readonly emoji: string;
      /** A custom emoji's picture: one code can name different pictures by different authors. */
      readonly url?: string;
      /** The NIP-51 address of the custom emoji's set, when known. */
      readonly address?: string;
      /** Display-only title from the selected source, never published. */
      readonly set?: string;
    };
type Held = {
  readonly id: string;
  readonly what: HeldWhat;
  timer: ReturnType<typeof setTimeout> | undefined;
  send(): void;
};

const held = new Map<string, Held>(); // bound: presses of the last UNDO_MS (plus those in flight)
const watchers = new Set<() => void>(); // bound: one per mounted list
const keyOf = (id: string, what: HeldWhat): string =>
  what.k === 'repost' ? `${id} repost` : `${id} reaction ${what.emoji} ${what.url ?? ''}`;
const changed = (): void => watchers.forEach((fn) => void fn());
const flush = (): void => [...held.values()].forEach((x) => void (x.timer && x.send()));
let bound = false;
const bind = (): void => {
  if (bound) return;
  bound = true;
  document.addEventListener(
    'visibilitychange',
    () => void (document.visibilityState === 'hidden' && flush()),
  );
  window.addEventListener('pagehide', flush);
};

/** Shows the action now and sends it when the undo time is over. `done` hears the engine's answer. */
export function hold(
  id: string,
  as: Pubkey,
  what: HeldWhat,
  act: (action: Action) => Promise<ActResult>,
  done: (r: ActResult) => void,
): void {
  const key = keyOf(id, what);
  if (held.has(key)) return;
  bind();
  const entry: Held = {
    id,
    what,
    timer: undefined,
    send() {
      clearTimeout(entry.timer);
      entry.timer = undefined;
      const sent: Extract<Action, { a: 'publish' }>['what'] =
        what.k === 'repost'
          ? { k: 'repost', id }
          : {
              k: 'reaction',
              id,
              emoji: what.emoji,
              url: what.url,
              ...(what.address ? { address: what.address } : {}),
            };
      // The row keeps showing it until the engine has answered (its own patch arrives before the answer).
      void act({ a: 'publish', as, what: sent }).then((r) => {
        held.delete(key);
        changed();
        done(r);
      });
    },
  };
  entry.timer = setTimeout(entry.send, UNDO_MS);
  held.set(key, entry);
  changed();
}
/** Takes back what still waits. False when it has already gone out (it then needs a real deletion). */
export function unhold(id: string, what: HeldWhat): boolean {
  const key = keyOf(id, what);
  const entry = held.get(key);
  if (!entry?.timer) return false;
  clearTimeout(entry.timer);
  held.delete(key);
  changed();
  return true;
}
/** Sends everything that waits (leaving the page; the account is about to change). */
export const sendHeld = flush;
export function onHeld(fn: () => void): () => void {
  watchers.add(fn);
  return () => void watchers.delete(fn);
}

/** The row as the reader should see it: with what waits here already done. */
export function withHeld(row: NoteRow): NoteRow {
  if (!held.size) return row;
  let out = row;
  for (const { id, what } of held.values()) {
    if (id !== row.id) continue;
    if (what.k === 'repost') {
      if (out.mine.reposted) continue;
      out = {
        ...out,
        mine: { ...out.mine, reposted: true },
        counts: { ...out.counts, reposts: out.counts.reposts + 1 },
      };
    } else {
      const there = out.reactions.find(
        (r) => r.emoji === what.emoji && (r.url ?? '') === (what.url ?? ''),
      );
      if (there?.mine) continue;
      const { emoji, url } = what;
      const mine = {
        emoji,
        url,
        address: what.address ?? there?.address,
        set: what.set ?? there?.set,
        count: (there?.count ?? 0) + 1,
        mine: true,
      };
      out = {
        ...out,
        counts: { ...out.counts, reactions: out.counts.reactions + 1 },
        reactions: there
          ? out.reactions.map((r) => (r === there ? { ...r, ...mine } : r))
          : [...out.reactions, mine],
      };
    }
  }
  return out;
}
