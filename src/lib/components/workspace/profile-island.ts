import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

type ProfileIslandHandle = {
  unmount: () => void;
};

type ProfileModule = {
  mount_profile_tab?: (
    parent: HTMLElement,
    tabId: string,
    pubkey: string,
    activePubkey: string,
    actions: ProfileIslandActions,
  ) => ProfileIslandHandle;
};

type ProfileIslandActions = {
  openProfile: (pubkey: string) => void;
  openFollowees: (pubkey: string) => void;
  openUserTimeline: (pubkey: string) => void;
  openProfileEdit: () => void;
  openThread: (eventId: string) => void;
  openAuthorContext: (eventId: string, pubkey: string) => void;
};

type ProfileIslandInput = {
  tabId: string;
  pubkey: string;
  activePubkey?: string;
  openProfile: (pubkey: string) => void;
  openFollowees: (pubkey: string) => void;
  openUserTimeline: (pubkey: string) => void;
  openProfileEdit: () => void;
  openThread: (eventId: string) => void;
  openAuthorContext: (eventId: string, pubkey: string) => void;
};

export async function mountProfileIsland(
  parent: HTMLElement,
  input: ProfileIslandInput,
): Promise<ProfileIslandHandle> {
  const module = (await loadLkjstrWebWasm()) as ProfileModule;
  const mount = module.mount_profile_tab;
  if (!mount) throw new Error('Rust Profile bridge unavailable.');
  return mount(parent, input.tabId, input.pubkey, input.activePubkey ?? '', {
    openProfile: input.openProfile,
    openFollowees: input.openFollowees,
    openUserTimeline: input.openUserTimeline,
    openProfileEdit: input.openProfileEdit,
    openThread: input.openThread,
    openAuthorContext: input.openAuthorContext,
  });
}
