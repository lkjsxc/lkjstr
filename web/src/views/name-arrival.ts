// A person drawn before their name arrived, and the moment the name takes the short npub's place. A pending name is
// quiet (muted, 500); the name that replaces it settles in once, briefly, in every tile that draws it in that moment,
// so a busy multi-tile workspace reads names arriving instead of text flickering. The widths stay one line either way.
const waiting = new Set<string>(); // bound: 4000 pubkeys, oldest dropped
const arrived = new Map<string, number>(); // bound: pubkeys whose name came within SETTLE_MS
export const SETTLE_MS = 600;

/** The class a name takes: `pending` while it is a short npub, `arrived` just after the name came. */
export function nameState(pubkey: string, unnamedNow: boolean, now = Date.now()): string {
  for (const [key, at] of arrived) if (now - at > SETTLE_MS) arrived.delete(key);
  if (unnamedNow) {
    waiting.add(pubkey);
    if (waiting.size > 4000) waiting.delete(waiting.values().next().value ?? '');
    return 'pending';
  }
  if (waiting.delete(pubkey)) arrived.set(pubkey, now);
  return arrived.has(pubkey) ? 'arrived' : '';
}
