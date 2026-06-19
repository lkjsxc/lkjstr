import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

type HomeIslandHandle = {
  unmount: () => void;
};

type HomeModule = {
  mount_home_tab?: (
    parent: HTMLElement,
    tabId: string,
    activePubkey: string,
    openProfile: (pubkey: string) => void,
    openThread: (eventId: string) => void,
    openAuthorContext: (eventId: string, pubkey: string) => void,
  ) => HomeIslandHandle;
};

type HomeIslandInput = {
  tabId: string;
  activePubkey?: string;
  openProfile: (pubkey: string) => void;
  openThread: (eventId: string) => void;
  openAuthorContext: (eventId: string, pubkey: string) => void;
};

export async function mountHomeIsland(
  parent: HTMLElement,
  input: HomeIslandInput,
): Promise<HomeIslandHandle> {
  const module = (await loadLkjstrWebWasm()) as HomeModule;
  const mount = module.mount_home_tab;
  if (!mount) throw new Error('Rust Home bridge unavailable.');
  return mount(
    parent,
    input.tabId,
    input.activePubkey ?? '',
    input.openProfile,
    input.openThread,
    input.openAuthorContext,
  );
}
