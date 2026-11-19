// Public client contracts; existing importers may continue importing them from client.ts.
import type { Signal } from '../shared/signal.ts';
import type { createDmClient } from './client-dm.ts';
import type { createSignerAuthClient } from './client-signer-auth.ts';
import type { createStorageClient } from './client-storage.ts';
import type { createZapClient } from './client-zaps.ts';
import type {
  Account,
  Action,
  Anchor,
  Delivery,
  EngineConfig,
  EngineStats,
  FromEngine,
  PatchOp,
  Pubkey,
  Query,
  Row,
  SubState,
  Timeline,
} from './protocol.ts';
export type SubHandlers = {
  rows(rows: readonly Row[], atTop: boolean, atBottom: boolean): void;
  patch(ops: readonly PatchOp[]): void;
  fresh?(count: number): void;
  timeline?(timeline: Timeline): void;
  state?(state: SubState): void;
};
export type Subscription = {
  readonly id: string;
  near(ids: readonly string[]): void;
  reading?(key: string | null): void;
  window(anchor: Anchor, before: number, after: number, liveAbove?: boolean): void;
  /** Whether its tab is in front (the engine may pause what is not). */
  visible(on: boolean): void;
  close(): void;
};
export type ActResult = Extract<FromEngine, { t: 'result' }>;
export type ActWatch = {
  uploadSignal?: AbortSignal;
  zapSignal?: AbortSignal;
  deliverySignal?: AbortSignal;
  progress?(sent: number, total: number, detail?: Extract<FromEngine, { t: 'progress' }>): void;
  delivery?(relays: readonly Delivery[]): void;
};
export type Accounts = { readonly accounts: readonly Account[]; readonly active?: Pubkey };
/** Account loading is separate from capability readiness and retained account rows. */
export type AccountState =
  | { readonly phase: 'loading' | 'ready' }
  | { readonly phase: 'failed'; readonly error: { readonly code: 'internal' } };
export type Engine = {
  readonly dm?: ReturnType<typeof createDmClient>;
  readonly zaps?: ReturnType<typeof createZapClient>;
  readonly signerAuth?: ReturnType<typeof createSignerAuthClient>;
  readonly storage?: ReturnType<typeof createStorageClient>;
  readonly accounts: Signal<Accounts>;
  readonly accountState?: Signal<AccountState>;
  readonly status: Signal<{ connected: number; wanted: number; offline: boolean }>;
  /** Which engine answered (`null` until it is ready). */
  readonly info: Signal<{ engine: string; version: number } | null>;
  /** The active account's pubkey ('' when signed out). */
  me(): Pubkey;
  open(query: Query, handlers: SubHandlers, owner?: HTMLElement): Subscription;
  act(action: Action, watch?: ActWatch): Promise<ActResult>;
  /** What the engine measured about itself, now. Undefined: this engine did not answer (it keeps no statistics). */
  stats(): Promise<EngineStats | undefined>;
  configure(config: EngineConfig): void;
  dispose(): void;
};
