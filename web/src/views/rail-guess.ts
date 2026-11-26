// Whether a list will have the time rail, before the engine says so. The rail's width is reserved from the first
// frame; reserving it for a list the engine then refuses (a Home with reposts, a device whose cache was cut short)
// drew every note narrower until the answer came a second later, then widened them all at once. So the first frame
// follows what the engine last said for the same kind of tab on this device, and only a kind never seen guesses yes.
import type { Timeline } from '../engine/protocol.ts';
import { kv } from '../shared/storage.ts';

const KEY = 'rails'; // { [railKey]: boolean }; bound: one entry per kind of tab and mode
// Kinds refused since this page loaded (bound: one per kind of tab). A Home can be accepted before its reposts
// resolve and refused after; the refusal is what its next start will meet, so a later acceptance does not undo it.
const refused = new Set<string>();

const read = (): Record<string, boolean> => {
  const value = kv.get(KEY);
  return value && typeof value === 'object' ? (value as Record<string, boolean>) : {};
};

export const railGuess = (kind: string): boolean => read()[kind] !== false;

/** Empty accepted counts can precede the first map. A provisional rail explicitly reserves its width. */
export const railAnswer = (next: Timeline | undefined): boolean | undefined =>
  next?.provisional ??
  (next && (!next.supported || next.months.length) ? next.supported : undefined);

/** The guess's key: the tab kind plus the query's mode, so a refused mode (signed-out Global) never narrows a
 * supported one (signed-in Global), and a Home with notifications is remembered apart from a note-only Home. */
export function railKey(
  kind: string,
  q?: { notifications?: boolean; show?: string; account?: string },
): string {
  const mode = [
    q?.notifications ? 'notifications' : '',
    q?.show ?? '',
    q && !q.account ? 'out' : '',
  ]
    .filter(Boolean)
    .join('+');
  return mode ? `${kind}:${mode}` : kind;
}

export function railSaid(kind: string, supported: boolean): void {
  if (!supported) refused.add(kind);
  const known = read();
  const next = supported && !refused.has(kind);
  if (known[kind] !== next) kv.set(KEY, { ...known, [kind]: next });
}
