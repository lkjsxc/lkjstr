import type { Account } from '../accounts/account';
import { shortNpub } from './display-name';

export type ProfileSummary = {
  readonly pubkey: string;
  readonly displayName: string | null;
  readonly name: string | null;
  readonly nip05: string | null;
  readonly avatarUrl: string | null;
  readonly about?: string | null;
  readonly website?: string | null;
  readonly lud16?: string | null;
  readonly lud06?: string | null;
  readonly updatedAt: number;
  readonly verifiedNip05?: boolean;
};

export type IdentityDisplay = {
  readonly pubkey: string;
  readonly title: string;
  readonly subtitle: string;
  readonly avatarUrl: string | null;
  readonly stale: boolean;
  readonly verifiedNip05: boolean;
};

export function identityDisplay(
  pubkey: string,
  profile?: ProfileSummary | Account,
  now = Date.now(),
): IdentityDisplay {
  const label = profile && 'label' in profile ? profile.label : null;
  const name = profile && 'name' in profile ? profile.name : null;
  const displayName = profile?.displayName ?? label ?? name;
  const subtitle = profile?.nip05 ?? shortNpub(pubkey);
  const verified =
    profile && 'verifiedNip05' in profile ? profile.verifiedNip05 : false;
  return {
    pubkey,
    title: displayName || shortNpub(pubkey),
    subtitle,
    avatarUrl: profile?.avatarUrl ?? null,
    stale: Boolean(
      profile && now - profile.updatedAt > 30 * 24 * 60 * 60 * 1000,
    ),
    verifiedNip05: Boolean(verified),
  };
}
