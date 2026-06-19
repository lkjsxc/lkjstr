import { describe, expect, it } from 'vitest';
import type { ResolvedReference } from '../../../src/lib/events/reference-resolver';
import type { ProfileSummary } from '../../../src/lib/identity/identity';
import type { NostrEvent } from '../../../src/lib/protocol';
import {
  eventReferenceCardKeyOpensThread,
  openEventReferenceCardThread,
  planEventReferenceCard,
} from '../../../src/lib/components/events/event-reference-card-plan';

describe('event reference card plan', () => {
  it('keeps unavailable references explicit without fake preview data', () => {
    const plan = planEventReferenceCard(
      { kind: 'quote', id: 'a'.repeat(64) },
      {},
    );

    expect(plan).toMatchObject({
      canOpenThread: false,
      event: undefined,
      label: 'Quoted event',
      mediaCount: 0,
      preview: '',
      profile: undefined,
      relays: [],
    });
  });

  it('normalizes preview, media count, relays, and profile from real event data', () => {
    const pubkey = 'b'.repeat(64);
    const profile = profileSummary(pubkey);
    const reference: ResolvedReference = {
      kind: 'reply-parent',
      id: 'c'.repeat(64),
      event: {
        event: event(pubkey),
        relays: ['wss://relay.example'],
      },
    };

    const plan = planEventReferenceCard(
      reference,
      { [pubkey]: profile },
      () => {
        return;
      },
    );

    expect(plan.canOpenThread).toBe(true);
    expect(plan.event?.pubkey).toBe(pubkey);
    expect(plan.label).toBe('Replying to');
    expect(plan.mediaCount).toBe(2);
    expect(plan.preview).toBe(
      'hello quoted event https://example.com/a.jpg https://example.com/page',
    );
    expect(plan.profile).toBe(profile);
    expect(plan.relays).toEqual(['wss://relay.example']);
  });

  it('keeps retained keyboard opening Enter-only', () => {
    expect(eventReferenceCardKeyOpensThread('Enter')).toBe(true);
    expect(eventReferenceCardKeyOpensThread(' ')).toBe(false);
    expect(eventReferenceCardKeyOpensThread('Escape')).toBe(false);
  });

  it('opens retained reference cards after suppressing row bubbling', () => {
    const calls: string[] = [];
    const opened = openEventReferenceCardThread(
      { canOpenThread: true },
      'event-id',
      (eventId) => calls.push(`open:${eventId}`),
      { stopPropagation: () => calls.push('stop') },
    );

    expect(opened).toBe(true);
    expect(calls).toEqual(['stop', 'open:event-id']);
  });

  it('does not open retained reference cards without real openers', () => {
    const calls: string[] = [];
    expect(
      openEventReferenceCardThread(
        { canOpenThread: false },
        'event-id',
        (eventId) => calls.push(`open:${eventId}`),
        { stopPropagation: () => calls.push('stop') },
      ),
    ).toBe(false);
    expect(
      openEventReferenceCardThread({ canOpenThread: true }, 'event-id'),
    ).toBe(false);
    expect(calls).toEqual(['stop']);
  });
});

function event(pubkey: string): NostrEvent {
  return {
    id: 'c'.repeat(64),
    pubkey,
    created_at: 1,
    kind: 1,
    tags: [],
    content:
      ' hello\n\nquoted   event https://example.com/a.jpg https://example.com/page ',
    sig: 'd'.repeat(128),
  };
}

function profileSummary(pubkey: string): ProfileSummary {
  return {
    pubkey,
    displayName: 'Display',
    name: 'name',
    nip05: null,
    avatarUrl: null,
    updatedAt: 1,
  };
}
