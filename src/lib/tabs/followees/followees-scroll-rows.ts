import type { FolloweeEntry } from '$lib/profile/followees';

export type FolloweesScrollRow =
  | { readonly kind: 'header' }
  | { readonly kind: 'guidance'; readonly message: string }
  | { readonly kind: 'retry' }
  | { readonly kind: 'status'; readonly message: string }
  | { readonly kind: 'followee'; readonly entry: FolloweeEntry };

export function followeesScrollRows(input: {
  readonly entries: readonly FolloweeEntry[];
  readonly message: string;
  readonly loading: boolean;
}): readonly FolloweesScrollRow[] {
  const rows: FolloweesScrollRow[] = [{ kind: 'header' }];
  if (input.message) rows.push({ kind: 'guidance', message: input.message });
  if (input.entries.length === 0 && !input.loading)
    rows.push({ kind: 'retry' });
  if (input.entries.length === 0)
    rows.push({
      kind: 'status',
      message: input.loading ? 'Loading following list...' : input.message,
    });
  for (const entry of input.entries) rows.push({ kind: 'followee', entry });
  return rows;
}

export function followeesScrollRowKey(row: FolloweesScrollRow): string {
  if (row.kind === 'header') return 'followees-header';
  if (row.kind === 'guidance') return 'followees-guidance';
  if (row.kind === 'retry') return 'followees-retry';
  if (row.kind === 'status') return 'followees-status';
  return `followee:${row.entry.pubkey}`;
}
