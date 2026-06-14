import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

type AuthorContextIslandHandle = {
  unmount: () => void;
};

type AuthorContextModule = {
  mount_author_context_tab?: (
    parent: HTMLElement,
    tabId: string,
    eventId: string,
    pubkey: string,
    openProfile: (pubkey: string) => void,
    openThread: (eventId: string) => void,
    openAuthorContext: (eventId: string, pubkey: string) => void,
  ) => AuthorContextIslandHandle;
};

type AuthorContextIslandInput = {
  tabId: string;
  eventId: string;
  pubkey: string;
  openProfile: (pubkey: string) => void;
  openThread: (eventId: string) => void;
  openAuthorContext: (eventId: string, pubkey: string) => void;
};

export async function mountAuthorContextIsland(
  parent: HTMLElement,
  input: AuthorContextIslandInput,
): Promise<AuthorContextIslandHandle> {
  const module = (await loadLkjstrWebWasm()) as AuthorContextModule;
  const mount = module.mount_author_context_tab;
  if (!mount) throw new Error('Rust Author Context bridge unavailable.');
  return mount(
    parent,
    input.tabId,
    input.eventId,
    input.pubkey,
    input.openProfile,
    input.openThread,
    input.openAuthorContext,
  );
}
