import { followingCount } from './profile-links';
import type { ProfileFollowListStatus } from './profile-state';
import type { NostrEvent } from '$lib/protocol';

export function profileFollowListStatus(
  event?: NostrEvent | null,
): ProfileFollowListStatus {
  if (!event) return 'loading-cache';
  return followingCount(event) === 0 ? 'known-empty' : 'known';
}

export function followCountKnown(status: ProfileFollowListStatus): boolean {
  return status === 'known' || status === 'known-empty';
}

export function followCountLabel(input: {
  readonly count: number;
  readonly status: ProfileFollowListStatus;
}): string {
  if (input.status === 'known') return `${input.count} following`;
  if (input.status === 'known-empty') return '0 following';
  if (input.status === 'loading-cache') return 'Loading following...';
  if (input.status === 'discovering-relays') return 'Calculating following...';
  if (input.status === 'incomplete') return 'Following incomplete';
  if (input.status === 'failed') return 'Following failed';
  return 'Following unavailable';
}
