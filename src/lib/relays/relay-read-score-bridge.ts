import type { RelayReadScore, RelayReadScoreInput } from './relay-read-score-types';

type BridgeResponse<T> = { readonly ok: true; readonly data: T };
type BridgeScore = Omit<RelayReadScore, 'updatedAt'> & {
  readonly updatedAtMs: number;
};

type RelayReadScoreBridge = {
  readonly initial?: (keyJson: string, updatedAtMs: number) => BridgeResponse<BridgeScore>;
  readonly update?: (
    scoreJson: string,
    observationJson: string,
  ) => BridgeResponse<BridgeScore>;
};

declare global {
  interface Window {
    readonly __lkjstrRelayReadScoreBridge?: RelayReadScoreBridge;
  }
}

export function bridgeInitialScore(key: unknown, updatedAt: number) {
  const bridged = bridge()?.initial?.(JSON.stringify(key), updatedAt);
  return bridged?.ok ? fromBridgeScore(bridged.data) : undefined;
}

export function bridgeUpdatedScore(
  previous: RelayReadScore,
  observation: RelayReadScoreInput,
) {
  const bridged = bridge()?.update?.(
    JSON.stringify(toBridgeScore(previous)),
    JSON.stringify(toBridgeObservation(observation)),
  );
  return bridged?.ok ? fromBridgeScore(bridged.data) : undefined;
}

function bridge(): RelayReadScoreBridge | undefined {
  return globalThis.window?.__lkjstrRelayReadScoreBridge;
}

function fromBridgeScore(score: BridgeScore): RelayReadScore {
  const { updatedAtMs, ...rest } = score;
  return { ...rest, updatedAt: updatedAtMs };
}

function toBridgeScore(score: RelayReadScore): BridgeScore {
  const { updatedAt, ...rest } = score;
  return { ...rest, updatedAtMs: updatedAt };
}

function toBridgeObservation(input: RelayReadScoreInput) {
  return {
    startedAtMs: input.startedAtMs ?? 0,
    firstEventMs: input.firstEventMs,
    eoseMs: input.eoseMs,
    durationMs: input.durationMs ?? 0,
    eventCount: input.eventCount,
    uniqueEventCount: input.uniqueEventCount ?? input.eventCount,
    finalCount: input.finalCount,
    timeout: Boolean(input.timeout),
    closed: Boolean(input.closed),
    auth: Boolean(input.auth),
    socketError: Boolean(input.socketError),
    eventLimitReached: Boolean(input.eventLimitReached),
    bytesSent: input.bytesSent ?? 0,
    bytesReceived: input.bytesReceived ?? 0,
    updatedAtMs: input.updatedAt,
  };
}
