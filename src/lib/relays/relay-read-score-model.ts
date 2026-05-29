import type {
  RelayReadScore,
  RelayReadScoreInput,
  RelayReadScoreKey,
} from './relay-read-score-types';

export function initialRelayReadScore(
  key: RelayReadScoreKey,
): RelayReadScore {
  return finalizeScore({
    key,
    reliability: 0.5,
    speed: 0.5,
    yield: 0.5,
    penalty: 0,
    sampleCount: 0,
    updatedAt: Date.now(),
  });
}

export function updateRelayReadScore(
  previous: RelayReadScore,
  observation: RelayReadScoreInput,
): RelayReadScore {
  const weight = previous.sampleCount === 0 ? 1 : 0.3;
  const latency = observation.firstEventMs ?? observation.eoseMs;
  return finalizeScore({
    key: previous.key,
    reliability: smooth(previous.reliability, reliability(observation), weight),
    speed: smooth(previous.speed, speed(latency), weight),
    yield: smooth(previous.yield, yieldScore(observation), weight),
    penalty: smooth(previous.penalty, penalty(observation), weight),
    sampleCount: Math.min(previous.sampleCount + 1, 10_000),
    updatedAt: observation.updatedAt,
  });
}

export function compareRelayReadScores(
  a: RelayReadScore,
  b: RelayReadScore,
): number {
  return (
    b.score - a.score ||
    b.reliability - a.reliability ||
    b.speed - a.speed ||
    a.key.relayUrl.localeCompare(b.key.relayUrl)
  );
}

function finalizeScore(
  input: Omit<RelayReadScore, 'score'>,
): RelayReadScore {
  const reliabilityValue = clamp(input.reliability);
  const speedValue = clamp(input.speed);
  const yieldValue = clamp(input.yield);
  const penaltyValue = clamp(input.penalty);
  return {
    ...input,
    reliability: reliabilityValue,
    speed: speedValue,
    yield: yieldValue,
    penalty: penaltyValue,
    score: clamp(
      reliabilityValue * 0.45 +
        speedValue * 0.3 +
        yieldValue * 0.2 -
        penaltyValue * 0.35,
    ),
  };
}

function reliability(input: RelayReadScoreInput): number {
  return input.eoseMs !== undefined && !failure(input) ? 1 : 0;
}

function speed(latency: number | undefined): number {
  if (latency === undefined) return 0.25;
  return 1 - Math.min(Math.max(latency, 0), 10_000) / 10_000;
}

function yieldScore(input: RelayReadScoreInput): number {
  const value =
    input.finalCount > 0 ? input.eventCount / input.finalCount : input.eventCount / 10;
  return clamp(value);
}

function penalty(input: RelayReadScoreInput): number {
  return clamp(
    Number(Boolean(input.timeout)) * 0.35 +
      Number(Boolean(input.socketError)) * 0.3 +
      Number(Boolean(input.closed)) * 0.2 +
      Number(Boolean(input.auth)) * 0.2 +
      Number(Boolean(input.eventLimitReached)) * 0.15,
  );
}

function failure(input: RelayReadScoreInput): boolean {
  return Boolean(
    input.timeout || input.closed || input.auth || input.socketError,
  );
}

function smooth(previous: number, next: number, weight: number): number {
  return previous * (1 - weight) + next * weight;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
