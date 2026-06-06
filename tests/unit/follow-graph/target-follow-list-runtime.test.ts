import { describe, expect, it } from 'vitest';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../../src/lib/protocol';
import type { SubscriptionOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';
import { runTargetFollowListRuntime } from '../../../src/lib/follow-graph/target-follow-list-runtime';

const subscriptions = {} as SubscriptionOrchestrator;

describe('target follow-list runtime', () => {
  it('discovers and stores a relay follow list after a cache miss', async () => {
    const targetKey = generateSecretKey();
    const target = getPublicKey(targetKey);
    const followee = getPublicKey(generateSecretKey());
    const event = finalizeEvent(
      { kind: 3, created_at: 10, content: '', tags: [['p', followee]] },
      targetKey,
    );
    const stored: string[] = [];
    const result = await runTargetFollowListRuntime({
      targetPubkey: target,
      selectedReadRelays: ['wss://relay.example/'],
      owner: 'tab',
      surface: 'followees',
      subscriptions,
      signal: new AbortController().signal,
      loadCached: async () => undefined,
      storeFound: async (found) => {
        stored.push(found.id);
      },
      readRelay: async () => ({
        type: 'found',
        followList: event,
        source: 'selected',
        attemptedRelays: ['wss://relay.example/'],
        failedRelays: [],
        relayUrls: ['wss://relay.example/'],
      }),
    });
    expect(result.state).toBe('found');
    expect(result.entries.map((entry) => entry.pubkey)).toEqual([followee]);
    expect(stored).toEqual([event.id]);
  });

  it('keeps cached rows during partial relay failure', async () => {
    const targetKey = generateSecretKey();
    const target = getPublicKey(targetKey);
    const followee = getPublicKey(generateSecretKey());
    const cached = finalizeEvent(
      { kind: 3, created_at: 10, content: '', tags: [['p', followee]] },
      targetKey,
    );
    const result = await runTargetFollowListRuntime({
      targetPubkey: target,
      selectedReadRelays: ['wss://relay.example/'],
      owner: 'tab',
      surface: 'followees',
      subscriptions,
      signal: new AbortController().signal,
      loadCached: async () => cached,
      storeFound: async () => undefined,
      readRelay: async () => ({
        type: 'partialFailure',
        attemptedRelays: ['wss://relay.example/'],
        failedRelays: ['wss://relay.example/'],
      }),
    });
    expect(result.state).toBe('partial_failure');
    expect(result.followList?.id).toBe(cached.id);
    expect(result.provenAbsent).toBe(false);
    expect(result.message).not.toBe('Follow-list discovery is incomplete.');
    expect(result.message).toContain('Retry');
  });

  it('proves absence only after a complete not-found read', async () => {
    const target = getPublicKey(generateSecretKey());
    const result = await runTargetFollowListRuntime({
      targetPubkey: target,
      selectedReadRelays: ['wss://relay.example/'],
      owner: 'tab',
      surface: 'followees',
      subscriptions,
      signal: new AbortController().signal,
      loadCached: async () => undefined,
      storeFound: async () => undefined,
      readRelay: async () => ({
        type: 'notFound',
        attemptedRelays: ['wss://relay.example/'],
        failedRelays: [],
      }),
    });
    expect(result.state).toBe('not_found_proven');
    expect(result.provenAbsent).toBe(true);
  });
});
