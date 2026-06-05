import type { ProfileState } from './profile-state';

export function profileEmptyText(next: ProfileState): string {
  if (next.loading) return 'Loading notes...';
  if (next.error) return 'Profile notes are partially unavailable.';
  if (next.hasOlder) return 'Searching older notes...';
  return 'No public notes found on attempted relays.';
}
