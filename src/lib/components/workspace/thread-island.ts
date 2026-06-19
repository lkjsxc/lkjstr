import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

type ThreadIslandHandle = {
  unmount: () => void;
};

type ThreadModule = {
  mount_thread_tab?: (
    parent: HTMLElement,
    tabId: string,
    eventId: string,
    openProfile: (pubkey: string) => void,
    openThread: (eventId: string) => void,
    openAuthorContext: (eventId: string, pubkey: string) => void,
  ) => ThreadIslandHandle;
};

type ThreadIslandInput = {
  tabId: string;
  eventId: string;
  openProfile: (pubkey: string) => void;
  openThread: (eventId: string) => void;
  openAuthorContext: (eventId: string, pubkey: string) => void;
};

export async function mountThreadIsland(
  parent: HTMLElement,
  input: ThreadIslandInput,
): Promise<ThreadIslandHandle> {
  const module = (await loadLkjstrWebWasm()) as ThreadModule;
  const mount = module.mount_thread_tab;
  if (!mount) throw new Error('Rust Thread bridge unavailable.');
  return mount(
    parent,
    input.tabId,
    input.eventId,
    input.openProfile,
    input.openThread,
    input.openAuthorContext,
  );
}
