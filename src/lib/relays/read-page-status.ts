import type { PoolEvent } from './relay-pool';
import type { RelaySnapshot } from './types';

export type ReadPageRelayStatus = {
  readonly relay: string;
  readonly eose: boolean;
  readonly timeout: boolean;
  readonly closed: boolean;
  readonly auth: boolean;
  readonly socketClosed: boolean;
  readonly socketError: boolean;
  readonly aborted?: boolean;
  readonly durationMs: number;
  readonly candidateCount: number;
  readonly finalCount: number;
};

export type ReadPageResult = {
  readonly events: PoolEvent[];
  readonly statuses: ReadPageRelayStatus[];
};

export function readStatuses(input: {
  readonly relays: readonly string[];
  readonly subId: string;
  readonly events: readonly PoolEvent[];
  readonly snapshots: readonly RelaySnapshot[];
  readonly timedOut: boolean;
  readonly aborted?: boolean;
  readonly durationMs: number;
}): ReadPageRelayStatus[] {
  return input.relays.map((relay) => relayStatus(relay, input));
}

function relayStatus(
  relay: string,
  input: Parameters<typeof readStatuses>[0],
): ReadPageRelayStatus {
  const snapshot = input.snapshots.find((item) => item.url === relay);
  const diagnostics = snapshot?.diagnostics ?? [];
  const count = input.events.filter((event) => event.relay === relay).length;
  return {
    relay,
    eose: Boolean(snapshot?.eoseBySub[input.subId]),
    timeout: input.timedOut,
    aborted: Boolean(input.aborted),
    closed: Boolean(snapshot?.closedBySub[input.subId]),
    auth: diagnostics.some((item) => item.kind === 'auth'),
    socketClosed: snapshot?.state === 'closed',
    socketError: snapshot?.state === 'error',
    durationMs: input.durationMs,
    candidateCount: count,
    finalCount: count,
  };
}
