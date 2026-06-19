import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

type NotificationsIslandHandle = {
  unmount: () => void;
};

type NotificationsModule = {
  mount_notifications_tab?: (
    parent: HTMLElement,
    tabId: string,
    activePubkey: string,
    openProfile: (pubkey: string) => void,
    openThread: (eventId: string) => void,
    openAuthorContext: (eventId: string, pubkey: string) => void,
  ) => NotificationsIslandHandle;
};

type NotificationsIslandInput = {
  tabId: string;
  activePubkey?: string;
  openProfile: (pubkey: string) => void;
  openThread: (eventId: string) => void;
  openAuthorContext: (eventId: string, pubkey: string) => void;
};

export async function mountNotificationsIsland(
  parent: HTMLElement,
  input: NotificationsIslandInput,
): Promise<NotificationsIslandHandle> {
  const module = (await loadLkjstrWebWasm()) as NotificationsModule;
  const mount = module.mount_notifications_tab;
  if (!mount) throw new Error('Rust Notifications bridge unavailable.');
  return mount(
    parent,
    input.tabId,
    input.activePubkey ?? '',
    input.openProfile,
    input.openThread,
    input.openAuthorContext,
  );
}
