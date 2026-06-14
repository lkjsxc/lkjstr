declare module 'virtual:lkjstr-web-wasm' {
  export type AuthorContextIslandHandle = {
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
  } & Record<string, unknown>;

  export function loadLkjstrWebWasm(): Promise<LkjstrWebWasmModule>;
}
