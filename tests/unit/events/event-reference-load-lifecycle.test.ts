import { describe, expect, it } from 'vitest';
import type { ResolvedReference } from '../../../src/lib/events/reference-resolver';
import type { ProfileSummary } from '../../../src/lib/identity/identity';
import type { NostrEvent } from '../../../src/lib/protocol';
import {
  loadEventReferences,
  type EventReferencesLoadedPlan,
} from '../../../src/lib/components/events/event-reference-hydration';

describe('event reference load lifecycle', () => {
  it('resolves, hydrates missing authors, and applies retained loaded state', async () => {
    const author = '1'.repeat(64);
    const hydrated = profile(author, 'Ada');
    const applied: EventReferencesLoadedPlan[] = [];
    const calls: string[] = [];

    await loadEventReferences({
      references: [{ kind: 'quote', id: 'e'.repeat(64) }],
      relays: ['wss://relay.example'],
      callbacks: {
        resolveReferences: async (input) => {
          calls.push(`resolve:${input.key}:${input.relays[0]}`);
          return [resolved(author)];
        },
        hydrateProfiles: async (input) => {
          calls.push(`hydrate:${input.owner}:${input.pubkeys[0]}`);
          return { [author]: hydrated };
        },
        isAlive: () => true,
        apply: (plan) => applied.push(plan),
      },
    });

    expect(calls).toEqual([
      `resolve:refs:1:${'e'.repeat(12)}:wss://relay.example`,
      `hydrate:event-references:${author}`,
    ]);
    expect(applied).toEqual([
      {
        loaded: true,
        profiles: { [author]: hydrated },
        resolved: [resolved(author)],
      },
    ]);
  });

  it('skips hydration and apply after resolve when unmounted', async () => {
    let aliveChecks = 0;
    const calls: string[] = [];

    await loadEventReferences({
      references: [{ kind: 'quote', id: 'e'.repeat(64) }],
      relays: [],
      callbacks: {
        resolveReferences: async () => [resolved('1'.repeat(64))],
        hydrateProfiles: async () => {
          calls.push('hydrate');
          return {};
        },
        isAlive: () => {
          aliveChecks += 1;
          return false;
        },
        apply: () => calls.push('apply'),
      },
    });

    expect(aliveChecks).toBe(1);
    expect(calls).toEqual([]);
  });

  it('skips apply after hydration when unmounted', async () => {
    const checks = [true, false];
    const calls: string[] = [];

    await loadEventReferences({
      references: [{ kind: 'quote', id: 'e'.repeat(64) }],
      relays: [],
      callbacks: {
        resolveReferences: async () => [resolved('1'.repeat(64))],
        hydrateProfiles: async () => {
          calls.push('hydrate');
          return {};
        },
        isAlive: () => checks.shift() ?? false,
        apply: () => calls.push('apply'),
      },
    });

    expect(calls).toEqual(['hydrate']);
  });
});

function resolved(pubkey: string): ResolvedReference {
  return {
    kind: 'quote',
    id: pubkey,
    event: { event: event(pubkey), relays: [] },
  };
}

function event(pubkey: string): NostrEvent {
  return {
    id: pubkey,
    pubkey,
    created_at: 1,
    kind: 1,
    tags: [],
    content: 'referenced event',
    sig: 'c'.repeat(128),
  };
}

function profile(pubkey: string, name: string): ProfileSummary {
  return {
    pubkey,
    displayName: name,
    name,
    nip05: null,
    avatarUrl: null,
    updatedAt: 1,
  };
}
