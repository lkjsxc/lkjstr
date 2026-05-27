import { boundedErrorText } from '../events/runtime-error';
import type { FeedCursorPoint } from '../events/types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import { loadOlderThreadPage } from './thread-runtime-pages';
import { loadNewerThreadPage } from './thread-runtime-pages-newer';
import type { ThreadItem } from './thread-store';
import type { ThreadState } from './thread-state';

export async function runThreadLoadOlder(input: {
  readonly eventId: string;
  readonly rootId: string;
  readonly owner: string;
  readonly items: () => ThreadItem[];
  readonly relays: readonly string[];
  readonly cursor: FeedCursorPoint;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly setCached: (items: ThreadItem[]) => void;
  readonly clearLive: () => void;
  readonly state: ThreadState;
  readonly emit: (next: ThreadState) => void;
}): Promise<void> {
  const page = await loadOlderThreadPage({
    eventId: input.eventId,
    rootId: input.rootId,
    items: input.items(),
    relays: input.relays,
    owner: input.owner,
    cursor: input.cursor,
    pageSize: input.pageSize,
    subscriptions: input.subscriptions,
    signal: input.signal,
  });
  input.setCached(page.items);
  input.clearLive();
  input.emit({
    ...input.state,
    items: input.items(),
    hasOlder: page.hasOlder,
    hasNewer: input.state.hasNewer || page.pruned,
    newerPruned: input.state.newerPruned || page.pruned,
  });
}

export async function runThreadLoadNewer(input: {
  readonly eventId: string;
  readonly rootId: string;
  readonly owner: string;
  readonly items: () => ThreadItem[];
  readonly relays: readonly string[];
  readonly cursor: FeedCursorPoint;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly setCached: (items: ThreadItem[]) => void;
  readonly clearLive: () => void;
  readonly state: ThreadState;
  readonly emit: (next: ThreadState) => void;
}): Promise<void> {
  const page = await loadNewerThreadPage({
    eventId: input.eventId,
    rootId: input.rootId,
    items: input.items(),
    relays: input.relays,
    owner: input.owner,
    cursor: input.cursor,
    pageSize: input.pageSize,
    subscriptions: input.subscriptions,
    signal: input.signal,
  });
  input.setCached(page.items);
  input.clearLive();
  input.emit({
    ...input.state,
    items: input.items(),
    hasNewer: page.hasNewer,
    hasOlder: input.state.hasOlder || page.pruned,
    newerPruned: page.hasNewer,
  });
}

export function threadPagingError(
  error: unknown,
  state: ThreadState,
): ThreadState {
  return { ...state, error: boundedErrorText(error) };
}
