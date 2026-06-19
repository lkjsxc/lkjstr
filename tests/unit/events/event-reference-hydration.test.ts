import { describe, expect, it } from 'vitest';
import type { ResolvedReference } from '../../../src/lib/events/reference-resolver';
import type { ProfileSummary } from '../../../src/lib/identity/identity';
import type { NostrEvent } from '../../../src/lib/protocol';
import {
  eventReferenceResolutionKey,
  eventReferencesLoadingStatus,
  eventReferencesShouldShowLoading,
  loadedEventReferencesPlan,
  mergeReferenceProfiles,
  missingReferenceAuthors,
} from '../../../src/lib/components/events/event-reference-hydration';

describe('event reference hydration', () => {
  it('keeps the retained reference resolver key stable', () => {
    expect(eventReferenceResolutionKey([])).toBe('refs:0:undefined');
    expect(
      eventReferenceResolutionKey([
        { kind: 'quote', id: 'a'.repeat(64), relays: [] },
        { kind: 'reply-parent', id: 'b'.repeat(64) },
      ]),
    ).toBe(`refs:2:${'a'.repeat(12)}`);
  });

  it('keeps the retained loading status explicit', () => {
    expect(eventReferencesLoadingStatus()).toBe('Loading referenced events...');
    expect(eventReferencesShouldShowLoading(false, 1)).toBe(true);
    expect(eventReferencesShouldShowLoading(false, 0)).toBe(false);
    expect(eventReferencesShouldShowLoading(true, 1)).toBe(false);
  });

  it('plans retained reference load completion state', () => {
    const retained = profile('1'.repeat(64), 'old');
    const hydrated = profile('2'.repeat(64), 'hydrated');
    const references = [resolved(retained.pubkey), resolved(hydrated.pubkey)];

    expect(
      loadedEventReferencesPlan(
        references,
        { [retained.pubkey]: retained },
        { [hydrated.pubkey]: hydrated },
      ),
    ).toEqual({
      loaded: true,
      profiles: { [retained.pubkey]: retained, [hydrated.pubkey]: hydrated },
      resolved: references,
    });
  });

  it('dedupes missing referenced-event authors without rehydrating profiles', () => {
    const existing = profile('2'.repeat(64));
    const references: ResolvedReference[] = [
      resolved('1'.repeat(64)),
      resolved('1'.repeat(64)),
      resolved(existing.pubkey),
      { kind: 'quote', id: 'e'.repeat(64) },
    ];

    expect(
      missingReferenceAuthors(references, { [existing.pubkey]: existing }),
    ).toEqual(['1'.repeat(64)]);
  });

  it('merges hydrated profiles over retained profiles', () => {
    const retained = profile('1'.repeat(64), 'old');
    const hydrated = profile('1'.repeat(64), 'new');
    const other = profile('2'.repeat(64), 'other');

    expect(
      mergeReferenceProfiles(
        { [retained.pubkey]: retained },
        { [hydrated.pubkey]: hydrated, [other.pubkey]: other },
      ),
    ).toEqual({ [hydrated.pubkey]: hydrated, [other.pubkey]: other });
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

function profile(pubkey: string, name = pubkey.slice(0, 4)): ProfileSummary {
  return {
    pubkey,
    displayName: name,
    name,
    nip05: null,
    avatarUrl: null,
    updatedAt: 1,
  };
}
