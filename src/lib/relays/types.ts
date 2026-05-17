import type { NostrEvent, RelayMessage } from '../protocol';

export type RelayConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error';

export type RelaySnapshot = {
  readonly url: string;
  readonly state: RelayConnectionState;
  readonly lastMessageAt?: number;
  readonly lastError?: string;
  readonly eoseBySub: Readonly<Record<string, boolean>>;
};

export type RelayClientEvents = {
  readonly event: (relay: string, subId: string, event: NostrEvent) => void;
  readonly message: (relay: string, message: RelayMessage) => void;
  readonly state: (snapshot: RelaySnapshot) => void;
};
