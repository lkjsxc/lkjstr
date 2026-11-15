// The accounts of the mock: two to start with (or none, for a first visit), and every way of adding one. A key the
// mock world does not know becomes a stranger whose profile has not arrived, named as the real engine names one.
import type { Account, Action, Author, Failure } from '../protocol.ts';
import { byPubkey, byRef, SECOND, SELF } from './people.ts';

type Entry = { readonly author: Author; signer: Account['signer'] };
type Add = Extract<Action, { a: 'account.add' }>;
const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const mix = (seed: string): (() => number) => {
  let x = 2166136261;
  for (const c of seed) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => (x = (Math.imul(x, 1103515245) + 12345) >>> 0) >>> 9;
};
const chars = (next: () => number, n: number, set: string): string =>
  Array.from({ length: n }, () => set[next() % set.length]).join('');

/** Someone the mock world has no profile of. `seed` is whatever named them: a pubkey stays that pubkey. */
export function stranger(seed: string): Author {
  const next = mix(seed);
  const pubkey = /^[0-9a-f]{64}$/.test(seed) ? seed : chars(next, 64, '0123456789abcdef');
  return { pubkey, npub: `npub1${chars(mix(pubkey), 58, B32)}`, name: pubkey };
}

export function createAccounts() {
  let list: Entry[] = [
    { author: SELF.author, signer: 'local' },
    { author: SECOND.author, signer: 'extension' },
  ]; // bound: 32, as the engine
  let active: string | undefined = SELF.author.pubkey;
  let made = 0;
  const put = (author: Author, signer: Entry['signer']): null => {
    const had = list.find((a) => a.author.pubkey === author.pubkey);
    // Adding a key that is already here only ever adds an ability: a read-only add does not take a signer away.
    if (had) had.signer = signer === 'none' ? had.signer : signer;
    else list.push({ author, signer });
    active = author.pubkey;
    return null;
  };
  return {
    list: (): readonly Entry[] => list,
    active: (): string | undefined => active,
    /** A first visit: nobody is signed in. */
    clear(): void {
      list = [];
      active = undefined;
    },
    use(pubkey: string): Failure['code'] | null {
      if (!list.some((a) => a.author.pubkey === pubkey)) return 'not-found';
      active = pubkey;
      return null;
    },
    remove(pubkey: string): Failure['code'] | null {
      if (!list.some((a) => a.author.pubkey === pubkey)) return 'not-found';
      list = list.filter((a) => a.author.pubkey !== pubkey);
      if (active === pubkey) active = list[0]?.author.pubkey;
      return null;
    },
    /** What an extension answered to `getPublicKey`. */
    extension: (pubkey: string): null =>
      put(byPubkey(pubkey)?.author ?? stranger(pubkey), 'extension'),
    /** Everything but the extension, which first has to be asked for its key. */
    add(a: Add): Failure['code'] | null {
      if (list.length >= 32) return 'too-large';
      if (a.how === 'create') return put(stranger(`created ${++made}`), 'local');
      if (a.how !== 'key') return 'unsupported';
      const key = a.key.trim();
      if (/^npub1[a-z0-9]{20,}$/.test(key)) return put(byRef(key)?.author ?? stranger(key), 'none');
      if (/^nsec1[a-z0-9]{20,}$/.test(key)) return put(stranger(key), 'local');
      if (/^bunker:\/\/[0-9a-f]{8,}/.test(key))
        return key.includes('refuse') ? 'signer-refused' : put(stranger(key), 'remote');
      return 'rejected';
    },
    /** The mock's "secret key": plainly not one, and the same each time it is asked for. */
    key(pubkey: string): string | undefined {
      const a = list.find((x) => x.author.pubkey === pubkey);
      return a?.signer === 'local' ? `nsec1${chars(mix(`secret ${pubkey}`), 58, B32)}` : undefined;
    },
  };
}
