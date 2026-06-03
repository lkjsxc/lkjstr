import { afterEach, describe, expect, it } from 'vitest';
import {
  initialRelayReadScore,
  scoreRelayCandidates,
  updateRelayReadScore,
  type RelayReadScore,
  type RelayReadScoreKey,
  type RelayReadScoreStore,
} from '../../../src/lib/relays/relay-read-score';

describe('relay read scoring', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('rewards fast successful reads and penalizes failures', () => {
    const key = scoreKey('wss://relay.example/');
    const initial = initialRelayReadScore(key);
    const fast = updateRelayReadScore(initial, {
      firstEventMs: 100,
      eoseMs: 250,
      durationMs: 250,
      eventCount: 5,
      finalCount: 5,
      updatedAt: 1,
    });
    const timeout = updateRelayReadScore(initial, {
      durationMs: 5000,
      eventCount: 0,
      finalCount: 0,
      timeout: true,
      updatedAt: 1,
    });
    const auth = updateRelayReadScore(initial, {
      durationMs: 100,
      eventCount: 0,
      finalCount: 0,
      auth: true,
      updatedAt: 1,
    });

    expect(fast.score).toBeGreaterThan(initial.score);
    expect(timeout.score).toBeLessThan(initial.score);
    expect(auth.score).toBeLessThan(initial.score);
  });

  it('uses the Rust bridge when it is available', () => {
    const key = scoreKey('wss://relay.example/');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __lkjstrRelayReadScoreBridge: {
          initial: (keyJson: string, updatedAtMs: number) => ({
            ok: true,
            data: bridgeScore(JSON.parse(keyJson), 0.99, updatedAtMs),
          }),
          update: (_scoreJson: string, observationJson: string) => {
            const observation = JSON.parse(observationJson) as {
              readonly updatedAtMs: number;
            };
            return {
              ok: true,
              data: bridgeScore(key, 0.77, observation.updatedAtMs),
            };
          },
        },
      },
    });

    const initial = initialRelayReadScore(key);
    const updated = updateRelayReadScore(initial, {
      durationMs: 1,
      eventCount: 1,
      finalCount: 1,
      updatedAt: 123,
    });

    expect(initial.score).toBe(0.99);
    expect(updated.score).toBe(0.77);
    expect(updated.updatedAt).toBe(123);
  });

  it('orders candidates by score without starving low-score relays', () => {
    const store = memoryStore();
    const fast = initialRelayReadScore(scoreKey('wss://fast.example/'));
    const slow = initialRelayReadScore(scoreKey('wss://slow.example/'));
    store.set({ ...fast, score: 0.9, reliability: 0.9 });
    store.set({ ...slow, score: 0.1, reliability: 0.1 });

    expect(
      scoreRelayCandidates(['slow.example', 'fast.example'], context(), store),
    ).toEqual(['wss://fast.example/', 'wss://slow.example/']);
  });
});

function memoryStore(): RelayReadScoreStore {
  const rows = new Map<string, RelayReadScore>();
  return {
    get: (key) => rows.get(JSON.stringify(key)),
    set: (score) => rows.set(JSON.stringify(score.key), score),
  };
}

function scoreKey(relayUrl: string): RelayReadScoreKey {
  return { relayUrl, ...context() };
}

function bridgeScore(
  key: RelayReadScoreKey,
  score: number,
  updatedAtMs: number,
) {
  return {
    key,
    reliability: score,
    firstEventSpeed: score,
    eoseSpeed: score,
    usefulYield: score,
    uniqueYield: score,
    penalty: 0,
    fairnessCredit: 0,
    sampleCount: 1,
    updatedAtMs,
    score,
  };
}

function context() {
  return {
    surface: 'home',
    phase: 'page',
    direction: 'older',
    routeGroupKey: 'default',
    filterShape: '[{"kinds":[1]}]',
    purpose: 'feed',
  };
}
