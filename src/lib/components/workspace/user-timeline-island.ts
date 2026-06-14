import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

type UserTimelineIslandHandle = {
  unmount: () => void;
};

type UserTimelineModule = {
  mount_user_timeline_tab?: (
    parent: HTMLElement,
    tabId: string,
    pubkey: string,
    openProfile: (pubkey: string) => void,
    openThread: (eventId: string) => void,
    openAuthorContext: (eventId: string, pubkey: string) => void,
  ) => UserTimelineIslandHandle;
};

type UserTimelineIslandInput = {
  tabId: string;
  pubkey: string;
  openProfile: (pubkey: string) => void;
  openThread: (eventId: string) => void;
  openAuthorContext: (eventId: string, pubkey: string) => void;
};

export async function mountUserTimelineIsland(
  parent: HTMLElement,
  input: UserTimelineIslandInput,
): Promise<UserTimelineIslandHandle> {
  const module = (await loadLkjstrWebWasm()) as UserTimelineModule;
  const mount = module.mount_user_timeline_tab;
  if (!mount) throw new Error('Rust User Timeline bridge unavailable.');
  return mount(
    parent,
    input.tabId,
    input.pubkey,
    input.openProfile,
    input.openThread,
    input.openAuthorContext,
  );
}
