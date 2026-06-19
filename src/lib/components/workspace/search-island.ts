import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';
import { registerTabRuntimeSnapshot } from '$lib/workspace/tab-runtime-registry';
import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';

type SearchIslandHandle = {
  unmount: () => void;
};

type SearchModule = {
  mount_search_tab?: (
    parent: HTMLElement,
    tabId: string,
    restoredQuery: string,
    saveQuery: (query: string) => void,
    openProfile: (pubkey: string) => void,
    openThread: (eventId: string) => void,
    openAuthorContext: (eventId: string, pubkey: string) => void,
  ) => SearchIslandHandle;
};

type SearchIslandInput = {
  tabId: string;
  restoreSnapshot?: TabSnapshotPayload;
  openProfile: (pubkey: string) => void;
  openThread: (eventId: string) => void;
  openAuthorContext: (eventId: string, pubkey: string) => void;
};

const searchQueries = new Map<string, string>();

export async function mountSearchIsland(
  parent: HTMLElement,
  input: SearchIslandInput,
): Promise<SearchIslandHandle> {
  const module = (await loadLkjstrWebWasm()) as SearchModule;
  const mount = module.mount_search_tab;
  if (!mount) throw new Error('Rust Search bridge unavailable.');
  let latestQuery = restoredQuery(input);
  const releaseSnapshot = registerTabRuntimeSnapshot(input.tabId, () => ({
    kind: 'feed',
    filterState: { searchQuery: latestQuery },
  }));
  const handle = mount(
    parent,
    input.tabId,
    latestQuery,
    (query) => {
      latestQuery = query;
      searchQueries.set(input.tabId, query);
    },
    input.openProfile,
    input.openThread,
    input.openAuthorContext,
  );
  return {
    unmount: () => {
      handle.unmount();
      releaseSnapshot();
    },
  };
}

function restoredQuery(input: SearchIslandInput): string {
  return (
    searchQueries.get(input.tabId) ??
    (input.restoreSnapshot?.kind === 'feed'
      ? input.restoreSnapshot.filterState?.searchQuery
      : undefined) ??
    ''
  );
}
