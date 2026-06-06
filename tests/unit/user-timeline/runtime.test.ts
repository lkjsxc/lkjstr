import { describe, expect, it } from 'vitest';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  type NostrEvent,
} from '../../../src/lib/protocol';
import type { SubscriptionOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';
import { runUserTimelineRuntime } from '../../../src/lib/user-timeline/user-timeline-runtime';
import type { TimelineItem } from '../../../src/lib/timeline/timeline-store';
import type { TargetFollowListSnapshot } from '../../../src/lib/follow-graph/target-follow-list-state';

const subscriptions = {} as SubscriptionOrchestrator;

describe('user timeline runtime', () => {
  it('keeps target-authored posts in an honest degraded mode', async () => {
    const target = getPublicKey(generateSecretKey());
    const snapshots: string[] = [];
    const final = await runUserTimelineRuntime({
      targetPubkey: target,
      relays: ['wss://relay.example/'],
      owner: 'tab',
      subscriptions,
      signal: new AbortController().signal,
      onSnapshot: (snapshot) => snapshots.push(snapshot.notice),
      loadCached: async () => [],
      readInitial: async ({ authors }) => ({
        items: [item(authors[0], '1')],
        hasOlder: false,
      }),
      runFollowList: async (args) => {
        const snapshot = followSnapshot(target, 'partial_failure', undefined, {
          attemptedRouteGroups: ['selected', 'provenance_routes'],
          failedRouteGroups: ['selected'],
          failedRelays: ['wss://relay.example/'],
        });
        args.onSnapshot?.(snapshot);
        return snapshot;
      },
    });

    expect(final.mode).toBe('target_posts_only');
    expect(final.items).toHaveLength(1);
    expect(final.discovery.state).toBe('target-posts-only');
    expect(final.discovery.canRetry).toBe(true);
    expect(final.notice).toContain('Public follow graph unavailable');
    expect(final.notice).toContain('Tried selected, provenance_routes');
    expect(snapshots.some((text) => text.includes('meanwhile'))).toBe(true);
  });

  it('switches from target-only reads to a found follow-graph author set', async () => {
    const targetKey = generateSecretKey();
    const target = getPublicKey(targetKey);
    const followee = getPublicKey(generateSecretKey());
    const followList = finalizeEvent(
      { kind: 3, created_at: 10, content: '', tags: [['p', followee]] },
      targetKey,
    );
    const calls: string[][] = [];
    const final = await runUserTimelineRuntime({
      targetPubkey: target,
      relays: ['wss://relay.example/'],
      owner: 'tab',
      subscriptions,
      signal: new AbortController().signal,
      onSnapshot: () => undefined,
      loadCached: async () => [],
      readInitial: async ({ authors }) => {
        calls.push([...authors]);
        return {
          items: authors.map((author, i) => item(author, String(i + 1))),
          hasOlder: false,
        };
      },
      runFollowList: async (args) => {
        const snapshot = followSnapshot(target, 'found', followList);
        args.onSnapshot?.(snapshot);
        return snapshot;
      },
    });

    expect(calls.some((authors) => authors.includes(followee))).toBe(true);
    expect(final.mode).toBe('follow_graph');
    expect(final.authors).toEqual([target, followee]);
    expect(final.discovery.followListEventId).toBe(followList.id);
  });
});

function followSnapshot(
  target: string,
  state: TargetFollowListSnapshot['state'],
  followList?: NostrEvent,
  patch: Partial<TargetFollowListSnapshot> = {},
): TargetFollowListSnapshot {
  return {
    state,
    targetPubkey: target,
    followList,
    entries: followList
      ? [
          {
            pubkey: followList.tags[0]?.[1] ?? '',
            petname: undefined,
            relayUrl: undefined,
          },
        ]
      : [],
    followingCount: followList ? 1 : 0,
    message: 'Follow-list discovery incomplete; retry target relay routes.',
    attemptedRelays: [],
    failedRelays: [],
    relayUrls: [],
    attemptedRouteGroups: [],
    failedRouteGroups: [],
    pendingRouteGroups: [],
    reasonCodes: [],
    partialFailure: false,
    provenAbsent: false,
    source: followList ? 'selected' : 'none',
    ...patch,
  };
}

function item(pubkey: string, id: string): TimelineItem {
  return {
    event: {
      id: id.repeat(64).slice(0, 64),
      pubkey,
      sig: '3'.repeat(128),
      kind: 1,
      tags: [],
      created_at: Number(id) || 1,
      content: '',
    },
    relays: ['wss://relay.example/'],
  };
}
