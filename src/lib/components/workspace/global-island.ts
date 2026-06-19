import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

type GlobalIslandHandle = {
  unmount: () => void;
};

type GlobalModule = {
  mount_global_tab?: (
    parent: HTMLElement,
    tabId: string,
    openProfile: (pubkey: string) => void,
    openThread: (eventId: string) => void,
    openAuthorContext: (eventId: string, pubkey: string) => void,
  ) => GlobalIslandHandle;
};

type GlobalIslandInput = {
  tabId: string;
  openProfile: (pubkey: string) => void;
  openThread: (eventId: string) => void;
  openAuthorContext: (eventId: string, pubkey: string) => void;
};

export async function mountGlobalIsland(
  parent: HTMLElement,
  input: GlobalIslandInput,
): Promise<GlobalIslandHandle> {
  const module = (await loadLkjstrWebWasm()) as GlobalModule;
  const mount = module.mount_global_tab;
  if (!mount) throw new Error('Rust Global bridge unavailable.');
  return mount(
    parent,
    input.tabId,
    input.openProfile,
    input.openThread,
    input.openAuthorContext,
  );
}
