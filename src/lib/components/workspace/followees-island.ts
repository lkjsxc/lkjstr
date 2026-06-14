import {
  copyUserRowNpub,
  userRowCopyStatusText,
} from '$lib/components/identity/user-row-copy-status';
import { safeNpub } from '$lib/components/identity/user-event-row';
import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

type FolloweesIslandHandle = {
  unmount: () => void;
};

type FolloweesModule = {
  mount_followees_tab?: (
    parent: HTMLElement,
    tabId: string,
    pubkey: string,
    openProfile: (pubkey: string) => void,
    openUserTimeline: (pubkey: string) => void,
    copyNpub: (pubkey: string) => void | Promise<void>,
  ) => FolloweesIslandHandle;
};

type FolloweesIslandInput = {
  tabId: string;
  pubkey: string;
  openProfile: (pubkey: string) => void;
  openUserTimeline: (pubkey: string) => void;
  setCopyStatus: (status: string) => void;
};

export async function mountFolloweesIsland(
  parent: HTMLElement,
  input: FolloweesIslandInput,
): Promise<FolloweesIslandHandle> {
  const module = (await loadLkjstrWebWasm()) as FolloweesModule;
  const mount = module.mount_followees_tab;
  if (!mount) throw new Error('Rust Followees bridge unavailable.');
  return mount(
    parent,
    input.tabId,
    input.pubkey,
    input.openProfile,
    input.openUserTimeline,
    (pubkey) => copyNpub(pubkey, input.setCopyStatus),
  );
}

async function copyNpub(
  pubkey: string,
  setCopyStatus: (status: string) => void,
): Promise<void> {
  const status = await copyUserRowNpub(safeNpub(pubkey), navigator.clipboard);
  setCopyStatus(userRowCopyStatusText(status));
}
