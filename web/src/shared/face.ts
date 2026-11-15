// The active account as it was last seen, kept on this device so that a reload shows the reader's face, name and
// whether the account can post in its first frame. Public profile data only; never a key.
import type { Account } from '../engine/protocol.ts';
import { kv } from './storage.ts';

const KEY = 'account:face';
const text = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.length <= max ? v : undefined;

export function rememberFace(me: Account | undefined): void {
  if (!me) return kv.remove(KEY);
  const { pubkey, npub, name, picture, emoji } = me.author;
  kv.set(KEY, { author: { pubkey, npub, name, picture, emoji }, signer: me.signer });
}

/** The remembered account when it is `pubkey`'s (as a one-account list), otherwise nothing. */
export function rememberedFace(pubkey: string): Account[] {
  const v = kv.get(KEY) as { author?: Record<string, unknown>; signer?: unknown } | undefined;
  const a = v?.author;
  const signer = (['local', 'extension', 'remote', 'none'] as const).find((s) => s === v?.signer);
  if (!a || a.pubkey !== pubkey || !signer) return [];
  const picture = text(a.picture, 2048);
  return [
    {
      author: {
        pubkey,
        npub: text(a.npub, 80) ?? '',
        name: text(a.name, 200) ?? '',
        picture: picture && /^(https:|data:image\/)/.test(picture) ? picture : undefined,
      },
      signer,
      unread: 0,
    },
  ];
}
