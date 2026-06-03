import { bridgeInitialScore, bridgeUpdatedScore } from './relay-read-score-bridge';
import type {
  RelayReadScore,
  RelayReadScoreInput,
  RelayReadScoreKey,
} from './relay-read-score-types';

const neutral = 0.5;
const speedCeilingMs = 10_000;
const earlySampleLimit = 20;
const eventLimitPenalty = 0.08;

export function initialRelayReadScore(key: RelayReadScoreKey): RelayReadScore {
  const updatedAt = Date.now();
  const bridged = bridgeInitialScore(key, updatedAt);
  if (bridged) return bridged;
  return finalizeScore({
    key,
    reliability: neutral,
    firstEventSpeed: neutral,
    eoseSpeed: neutral,
    usefulYield: neutral,
    uniqueYield: neutral,
    penalty: 0,
    fairnessCredit: neutral,
    sampleCount: 0,
    updatedAt,
  });
}

export function updateRelayReadScore(
  previous: RelayReadScore,
  observation: RelayReadScoreInput,
): RelayReadScore {
  const bridged = bridgeUpdatedScore(previous, observation);
  if (bridged) return bridged;
  const weight = smoothingWeight(previous.sampleCount);
  return finalizeScore({
    key: previous.key,
    reliability: smooth(previous.reliability, reliability(observation), weight),
    firstEventSpeed: smooth(
      previous.firstEventSpeed,
      firstEventSpeed(observation),
      weight,
    ),
    eoseSpeed: smooth(previous.eoseSpeed, eoseSpeed(observation), weight),
    usefulYield: smooth(previous.usefulYield, usefulYield(observation), weight),
    uniqueYield: smooth(previous.uniqueYield, uniqueYield(observation), weight),
    penalty: smooth(previous.penalty, penalty(observation), weight),
    fairnessCredit: previous.fairnessCredit,
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
    b.firstEventSpeed - a.firstEventSpeed ||
    b.eoseSpeed - a.eoseSpeed ||
    a.key.relayUrl.localeCompare(b.key.relayUrl)
  );
}

function finalizeScore(input: Omit<RelayReadScore, 'score'>): RelayReadScore {
  const reliabilityValue = clamp(input.reliability);
  const firstEventSpeedValue = clamp(input.firstEventSpeed);
  const eoseSpeedValue = clamp(input.eoseSpeed);
  const usefulYieldValue = clamp(input.usefulYield);
  const uniqueYieldValue = clamp(input.uniqueYield);
  const penaltyValue = clamp(input.penalty);
  const fairnessCreditValue = clamp(input.fairnessCredit);
  return {
    ...input,
    reliability: reliabilityValue,
    firstEventSpeed: firstEventSpeedValue,
    eoseSpeed: eoseSpeedValue,
    usefulYield: usefulYieldValue,
    uniqueYield: uniqueYieldValue,
    penalty: penaltyValue,
    fairnessCredit: fairnessCreditValue,
    score: clamp(
      reliabilityValue * 0.34 +
        firstEventSpeedValue * 0.18 +
        eoseSpeedValue * 0.12 +
        usefulYieldValue * 0.16 +
        uniqueYieldValue * 0.1 +
        fairnessCreditValue * 0.05 -
        penaltyValue * 0.35,
    ),
  };
}

function reliability(input: RelayReadScoreInput): number {
  if (input.eoseMs !== undefined && !failure(input)) return 1;
  if (failure(input)) return 0;
  if (input.eventCount > 0 && !input.timeout) return 0.65;
  return neutral;
}

function firstEventSpeed(input: RelayReadScoreInput): number {
  return input.firstEventMs === undefined
    ? 0.25
    : speed(input, input.firstEventMs);
}

function eoseSpeed(input: RelayReadScoreInput): number {
  return input.eoseMs === undefined ? 0.25 : speed(input, input.eoseMs);
}

function speed(input: RelayReadScoreInput, atMs: number): number {
  const startedAt = input.startedAtMs ?? 0;
  const latency = Math.max(0, atMs - startedAt);
  return 1 - Math.min(latency, speedCeilingMs) / speedCeilingMs;
}

function usefulYield(input: RelayReadScoreInput): number {
  return input.finalCount > 0
    ? ratio(input.eventCount, input.finalCount)
    : ratio(input.eventCount, 10);
}

function uniqueYield(input: RelayReadScoreInput): number {
  return input.eventCount > 0
    ? ratio(input.uniqueEventCount ?? input.eventCount, input.eventCount)
    : 0;
}

function penalty(input: RelayReadScoreInput): number {
  return clamp(
    Number(Boolean(input.timeout)) * 0.35 +
      Number(Boolean(input.socketError)) * 0.3 +
      Number(Boolean(input.closed)) * 0.2 +
      Number(Boolean(input.auth)) * 0.2 +
      Number(Boolean(input.eventLimitReached)) * eventLimitPenalty,
  );
}

function smoothingWeight(previousSampleCount: number): number {
  if (previousSampleCount === 0) return 1;
  return previousSampleCount < earlySampleLimit ? 0.25 : 0.1;
}

function failure(input: RelayReadScoreInput): boolean {
  return Boolean(input.timeout || input.closed || input.auth || input.socketError);
}

function ratio(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : clamp(numerator / denominator);
}

function smooth(previous: number, next: number, weight: number): number {
  return previous * (1 - weight) + next * weight;
}

function clamp(value: number): number {
  return Number.isNaN(value) ? neutral : Math.max(0, Math.min(1, value));
}

