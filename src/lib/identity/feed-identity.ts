import type { Account } from '../accounts/account';
import type { IdentityDisplay, ProfileSummary } from './identity';

export function feedIdentityDisplay(
  pubkey: string,
  profile?: ProfileSummary | Account,
  now = Date.now(),
): IdentityDisplay {
  const label = profile && 'label' in profile ? profile.label : null;
  const name = profile && 'name' in profile ? profile.name : null;
  const displayName = profile?.displayName ?? label ?? name;
  const verified =
    profile && 'verifiedNip05' in profile ? profile.verifiedNip05 : false;
  return {
    pubkey,
    title: displayName ?? 'Unknown',
    subtitle: profile?.nip05 ?? '',
    avatarUrl: profile?.avatarUrl ?? null,
    stale: Boolean(
      profile && now - profile.updatedAt > 30 * 24 * 60 * 60 * 1000,
    ),
    verifiedNip05: Boolean(verified),
  };
}
