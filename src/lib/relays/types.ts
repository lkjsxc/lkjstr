import type { NostrEvent, RelayMessage } from '../protocol';

export type RelayDiagnosticKind =
  | 'closed'
  | 'notice'
  | 'auth'
  | 'timeout'
  | 'parse-error'
  | 'invalid-event'
  | 'invalid-subscription';

export type RelayDiagnostic = {
  readonly relay: string;
  readonly subId?: string;
  readonly kind: RelayDiagnosticKind;
  readonly message: string;
  readonly timestamp: number;
};

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
  readonly diagnostics: readonly RelayDiagnostic[];
  readonly eoseBySub: Readonly<Record<string, boolean>>;
  readonly closedBySub: Readonly<Record<string, string>>;
};

export type RelayClientEvents = {
  readonly event: (relay: string, subId: string, event: NostrEvent) => void;
  readonly message: (relay: string, message: RelayMessage) => void;
  readonly state: (snapshot: RelaySnapshot) => void;
};
