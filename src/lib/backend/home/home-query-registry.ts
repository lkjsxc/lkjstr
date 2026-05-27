import { relaySubscriptionHash } from '../../relays/subscription-id';
import {
  createTimelineRuntime,
  type TimelineRuntime,
} from '../../timeline/timeline-runtime';
import type { TimelineRuntimeOptions } from '../../timeline/timeline-state';
import { homeQueryKey, type HomeQueryKeyInput } from './home-query-key';

export type HomeQueryAttachment = {
  readonly subscribe: TimelineRuntime['subscribe'];
  readonly setVisibility: (visible: boolean) => void;
  readonly loadOlder: TimelineRuntime['loadOlder'];
  readonly loadNewer: TimelineRuntime['loadNewer'];
  readonly start: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly retryFollowDiscovery: () => void;
  readonly snapshot: TimelineRuntime['snapshot'];
  readonly items: TimelineRuntime['items'];
  readonly close: () => void;
};

type Entry = {
  readonly key: string;
  readonly runtime: TimelineRuntime;
  readonly visibility: Map<string, boolean>;
  refs: number;
  started: boolean;
};

const registry = new Map<string, Entry>();

export function attachRegistryHomeQuery(input: {
  readonly tabId: string;
  readonly query: HomeQueryKeyInput;
  readonly seed?: TimelineRuntimeOptions['seed'];
  readonly pool?: TimelineRuntimeOptions['pool'];
  readonly subscriptions?: TimelineRuntimeOptions['subscriptions'];
}): HomeQueryAttachment {
  const key = homeQueryKey(input.query);
  const entry = registry.get(key) ?? createEntry(key, input);
  registry.set(key, entry);
  entry.refs += 1;
  entry.visibility.set(input.tabId, true);
  syncVisibility(entry);
  if (!entry.started) {
    entry.started = true;
    void entry.runtime.start();
  }
  let closed = false;
  return {
    subscribe: entry.runtime.subscribe,
    setVisibility: (visible) => {
      if (closed) return;
      entry.visibility.set(input.tabId, visible);
      syncVisibility(entry);
    },
    loadOlder: entry.runtime.loadOlder,
    loadNewer: entry.runtime.loadNewer,
    start: async () => undefined,
    refresh: entry.runtime.loadNewer,
    retryFollowDiscovery: () => entry.runtime.retryFollowDiscovery?.(),
    snapshot: entry.runtime.snapshot,
    items: entry.runtime.items,
    close: () => {
      if (closed) return;
      closed = true;
      entry.refs -= 1;
      entry.visibility.delete(input.tabId);
      if (entry.refs > 0) {
        syncVisibility(entry);
        return;
      }
      entry.runtime.close();
      registry.delete(key);
    },
  };
}

export function homeQueryRegistrySize(): number {
  return registry.size;
}

function createEntry(
  key: string,
  input: Parameters<typeof attachRegistryHomeQuery>[0],
): Entry {
  const runtime = createTimelineRuntime({
    relays: input.query.relays,
    owner: `home-query:${relaySubscriptionHash(key, 10)}`,
    subId: `hq:${relaySubscriptionHash(key, 16)}`,
    kind: 'home',
    activeAccountPubkey: input.query.accountPubkey,
    limit: input.query.pageSize,
    seed: input.seed,
    pool: input.pool,
    subscriptions: input.subscriptions,
  });
  return {
    key,
    runtime,
    visibility: new Map(),
    refs: 0,
    started: false,
  };
}

function syncVisibility(entry: Entry): void {
  entry.runtime.setVisibility([...entry.visibility.values()].some(Boolean));
}
