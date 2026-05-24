export type ProfilePointer = {
  readonly pubkey: string;
  readonly relays?: readonly string[];
};

export type EventPointer = {
  readonly id: string;
  readonly relays?: readonly string[];
  readonly author?: string;
  readonly kind?: number;
};

export type AddressPointer = {
  readonly identifier: string;
  readonly pubkey: string;
  readonly kind: number;
  readonly relays?: readonly string[];
};

export type NostrEntity =
  | { readonly type: 'npub'; readonly data: string }
  | { readonly type: 'nsec'; readonly data: Uint8Array }
  | { readonly type: 'note'; readonly data: string }
  | { readonly type: 'nprofile'; readonly data: ProfilePointer }
  | { readonly type: 'nevent'; readonly data: EventPointer }
  | { readonly type: 'naddr'; readonly data: AddressPointer };
