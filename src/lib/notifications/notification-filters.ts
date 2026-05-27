import type { NostrFilter } from '../protocol';
import { assertRelayFilterIsProtocolSafe } from '../query/timeline-filters';
export const notificationEventKinds = [0, 1, 6, 7, 16, 9735] as const;

export type NotificationFilterInput = {
  readonly accountPubkey: string;
  readonly cursor: Pick<NostrFilter, 'since' | 'until'>;
  readonly limit: number;
};

export function buildNotificationFilters(
  input: NotificationFilterInput,
): readonly NostrFilter[] {
  const filter: NostrFilter = {
    kinds: [...notificationEventKinds],
    '#p': [input.accountPubkey],
    limit: input.limit,
    ...input.cursor,
  };
  assertRelayFilterIsProtocolSafe(filter);
  return [filter];
}

export function notificationFilterTargetsAccount(
  filter: NostrFilter,
  accountPubkey: string,
): boolean {
  const tags = filter['#p'];
  return Boolean(tags?.includes(accountPubkey) && !filter.authors?.length);
}
