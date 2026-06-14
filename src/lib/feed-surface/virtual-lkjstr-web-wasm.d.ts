declare module 'virtual:lkjstr-web-wasm' {
  export type AuthorContextIslandHandle = {
    readonly unmount: () => void;
  };

  export type FolloweesIslandHandle = {
    readonly unmount: () => void;
  };

  export type UserTimelineIslandHandle = {
    readonly unmount: () => void;
  };

  export type LkjstrWebWasmModule = {
    readonly mount_author_context_tab?: (
      parent: HTMLElement,
      tabId: string,
      eventId: string,
      pubkey: string,
      openProfile: (pubkey: string) => void,
      openThread: (eventId: string) => void,
      openAuthorContext: (eventId: string, pubkey: string) => void,
    ) => AuthorContextIslandHandle;
    readonly mount_followees_tab?: (
      parent: HTMLElement,
      tabId: string,
      pubkey: string,
      openProfile: (pubkey: string) => void,
      openUserTimeline: (pubkey: string) => void,
      copyNpub: (pubkey: string) => void,
    ) => FolloweesIslandHandle;
    readonly mount_user_timeline_tab?: (
      parent: HTMLElement,
      tabId: string,
      pubkey: string,
      openProfile: (pubkey: string) => void,
      openThread: (eventId: string) => void,
      openAuthorContext: (eventId: string, pubkey: string) => void,
    ) => UserTimelineIslandHandle;
    readonly user_timeline_diagnostics_snapshot?: () => unknown;
  } & Record<string, unknown>;

  export function loadLkjstrWebWasm(): Promise<LkjstrWebWasmModule>;
}
