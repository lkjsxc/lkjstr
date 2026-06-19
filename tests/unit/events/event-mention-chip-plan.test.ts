import { describe, expect, it } from 'vitest';
import type { ProfileSummary } from '../../../src/lib/identity/identity';
import type { NostrEvent } from '../../../src/lib/protocol';
import {
  eventMentionExcerpt,
  eventMentionHydrationPlan,
  eventMentionLoadedPlan,
  openEventMentionThread,
  planEventMentionChip,
} from '../../../src/lib/components/events/event-mention-chip-plan';

describe('event mention chip plan', () => {
  it('keeps resolver identity, label, and relay ordering stable', () => {
    const plan = planEventMentionChip({
      eventId: 'abcdef1234567890'.padEnd(64, '0'),
      relays: ['wss://a.example', 'wss://b.example'],
      fallbackRelays: ['wss://b.example', 'wss://c.example'],
      openThread: () => undefined,
    });

    expect(plan.canOpenThread).toBe(true);
    expect(plan.label).toBe('event:abcdef12');
    expect(plan.resolverKey).toBe('mention:abcdef123456');
    expect(plan.reference).toEqual({
      kind: 'nostr-event',
      id: 'abcdef1234567890'.padEnd(64, '0'),
      relays: ['wss://a.example', 'wss://b.example'],
    });
    expect(plan.relays).toEqual([
      'wss://a.example',
      'wss://b.example',
      'wss://c.example',
    ]);
  });

  it('opens retained event mentions without bubbling into the row', () => {
    let stopped = 0;
    const opened: string[] = [];
    const event = { stopPropagation: () => (stopped += 1) };

    openEventMentionThread(event, (eventId) => opened.push(eventId), 'event-a');
    openEventMentionThread(event, undefined, 'event-b');

    expect(stopped).toBe(2);
    expect(opened).toEqual(['event-a']);
  });

  it('normalizes excerpts without inventing missing content', () => {
    expect(eventMentionExcerpt(event(' hello\n\nthere   now '))).toBe(
      'hello there now',
    );
    expect(eventMentionExcerpt(event('x'.repeat(120)))).toHaveLength(96);
  });

  it('uses existing profiles before planning hydration', () => {
    const pubkey = 'b'.repeat(64);
    const profile = profileSummary(pubkey);

    expect(
      eventMentionHydrationPlan(event('', pubkey), { [pubkey]: profile }),
    ).toEqual({ profile, pubkeys: [] });
    expect(eventMentionHydrationPlan(event('', pubkey), {})).toEqual({
      profile: undefined,
      pubkeys: [pubkey],
    });
  });

  it('plans retained loaded excerpt and hydrated profile state', () => {
    const pubkey = 'b'.repeat(64);
    const retained = profileSummary(pubkey);
    const hydrated = profileSummary(pubkey, 'Hydrated');

    expect(
      eventMentionLoadedPlan(event(' hello\nthere ', pubkey), {
        [pubkey]: retained,
      }),
    ).toEqual({
      excerpt: 'hello there',
      profile: retained,
    });
    expect(
      eventMentionLoadedPlan(
        event(' fresh content ', pubkey),
        {},
        {
          [pubkey]: hydrated,
        },
      ),
    ).toEqual({
      excerpt: 'fresh content',
      profile: hydrated,
    });
    expect(eventMentionLoadedPlan(event('missing', pubkey))).toEqual({
      excerpt: 'missing',
      profile: undefined,
    });
  });
});

function event(content: string, pubkey = 'a'.repeat(64)): NostrEvent {
  return {
    id: 'c'.repeat(64),
    pubkey,
    created_at: 1,
    kind: 1,
    tags: [],
    content,
    sig: 'd'.repeat(128),
  };
}

function profileSummary(
  pubkey: string,
  displayName = 'Display',
): ProfileSummary {
  return {
    pubkey,
    displayName,
    name: 'name',
    nip05: null,
    avatarUrl: null,
    updatedAt: 1,
  };
}
