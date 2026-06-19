import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';
import { registerTabRuntimeSnapshot } from '$lib/workspace/tab-runtime-registry';
import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';

type CustomRequestIslandHandle = {
  unmount: () => void;
};

type CustomRequestModule = {
  mount_custom_request_tab?: (
    parent: HTMLElement,
    tabId: string,
    restoredState: string,
    saveState: (input: string, ran: boolean) => void,
    openProfile: (pubkey: string) => void,
    openThread: (eventId: string) => void,
    openAuthorContext: (eventId: string, pubkey: string) => void,
  ) => CustomRequestIslandHandle;
};

type CustomRequestIslandInput = {
  tabId: string;
  restoreSnapshot?: TabSnapshotPayload;
  openProfile: (pubkey: string) => void;
  openThread: (eventId: string) => void;
  openAuthorContext: (eventId: string, pubkey: string) => void;
};

type CustomRequestState = {
  input: string;
  ran: boolean;
};

const defaultInput = '{"kinds":[1],"limit":30}';
const customRequestStates = new Map<string, CustomRequestState>();

export async function mountCustomRequestIsland(
  parent: HTMLElement,
  input: CustomRequestIslandInput,
): Promise<CustomRequestIslandHandle> {
  const module = (await loadLkjstrWebWasm()) as CustomRequestModule;
  const mount = module.mount_custom_request_tab;
  if (!mount) throw new Error('Rust Custom Request bridge unavailable.');
  let latest = restoredState(input);
  const releaseSnapshot = registerTabRuntimeSnapshot(input.tabId, () => ({
    kind: 'feed',
    filterState: {
      customRequestInput: latest.input,
      customRequestRan: String(latest.ran),
    },
  }));
  const handle = mount(
    parent,
    input.tabId,
    JSON.stringify(latest),
    (rawInput, ran) => {
      latest = { input: rawInput, ran };
      customRequestStates.set(input.tabId, latest);
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

function restoredState(input: CustomRequestIslandInput): CustomRequestState {
  const cached = customRequestStates.get(input.tabId);
  if (cached) return cached;
  const snapshot = input.restoreSnapshot;
  if (snapshot?.kind !== 'feed') return { input: defaultInput, ran: false };
  return {
    input: snapshot.filterState?.customRequestInput ?? defaultInput,
    ran: snapshot.filterState?.customRequestRan === 'true',
  };
}
