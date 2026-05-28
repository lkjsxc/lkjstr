import type { Snippet } from 'svelte';
import type { FeedEvent } from '$lib/events/types';
import type { ProfileSummary } from '$lib/identity/identity';
import type { RelaySet } from '$lib/relays/relay-store';
import type {
  ReactionSummaryMap,
  RepostSummaryMap,
} from '$lib/thread/thread-reactions';
import type { EventTreeListLeadingRow } from './event-tree-list-helpers';
import type {
  OlderLoadMode,
  OlderLoadTrigger,
} from '$lib/feed-surface/older-load-mode';

export type EventTreeListProps = {
  items: readonly FeedEvent[];
  profiles?: Record<string, ProfileSummary>;
  relaySets?: readonly RelaySet[];
  activeAccountPubkey?: string | null;
  reactions?: ReactionSummaryMap;
  reposts?: RepostSummaryMap;
  loading?: boolean;
  loadingOlder?: boolean;
  loadingNewer?: boolean;
  hasOlder?: boolean;
  hasNewer?: boolean;
  pagingError?: string | null;
  emptyText?: string;
  onNearEnd?: (trigger: OlderLoadTrigger) => void | Promise<void>;
  onNearStart?: () => void | Promise<void>;
  openProfile?: (pubkey: string) => void;
  openThread?: (eventId: string) => void;
  openAuthorContext?: (eventId: string, pubkey: string) => void;
  tabId?: string;
  intentKey?: string;
  pagingEnabled?: boolean;
  olderLoadMode?: OlderLoadMode;
  restoreAnchor?: { readonly eventId: string; readonly offset: number };
  leadingRows?: readonly EventTreeListLeadingRow[];
  leadingRow?: Snippet<[EventTreeListLeadingRow]>;
};
