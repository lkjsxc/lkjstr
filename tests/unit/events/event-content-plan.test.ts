import {
  finalizeEvent,
  generateSecretKey,
  kinds,
  type NostrEvent,
} from '../../../src/lib/protocol';
import {
  eventContentReferences,
  eventRepostTargetLabel,
  planEventContent,
  planEventContentCore,
  revealEventContent,
} from '../../../src/lib/components/events/event-content-plan';
import { describe, expect, it } from 'vitest';

describe('event content plan', () => {
  it('renders verified nested reposts and hides their duplicate reference', () => {
    const target = signedEvent({ content: 'reposted body' });
    const repost = signedEvent({
      kind: kinds.repost,
      tags: [['e', target.id]],
      content: JSON.stringify(target),
    });

    const plan = planEventContent(repost);
    expect(plan.nested?.id).toBe(target.id);
    expect(plan.references).toEqual([]);

    const fallback = planEventContent(repost, { renderNestedRepost: false });
    expect(fallback.nested).toBeUndefined();
    expect(fallback.references.map((item) => item.id)).toEqual([target.id]);
  });

  it('plans the retained nested repost target label', () => {
    expect(eventRepostTargetLabel()).toBe('Reposted event');
  });

  it('filters self references and suppresses deep reference previews', () => {
    const quoted = '2'.repeat(64);
    const source = rawEvent({
      id: '1'.repeat(64),
      tags: [
        ['e', '1'.repeat(64), '', 'reply'],
        ['q', quoted, 'wss://relay.example'],
      ],
    });

    expect(eventContentReferences(source).map((item) => item.id)).toEqual([
      quoted,
    ]);
    expect(eventContentReferences(source, { depth: 2 })).toEqual([]);
  });

  it('plans core rendering without link attachments or fake action states', () => {
    const reference = '3'.repeat(64);
    const note = rawEvent({
      kind: kinds.reaction,
      content: '+ https://example.com/a.jpg https://example.com/page',
      tags: [['content-warning', 'spoiler']],
    });

    const plan = planEventContentCore(
      note,
      [{ kind: 'quote', id: reference, source: 'q' }],
      { hideSensitive: true, revealed: false },
    );

    expect([...plan.referenceIds]).toEqual([reference]);
    expect(plan.attachments).toEqual([
      { url: 'https://example.com/a.jpg', type: 'image' },
    ]);
    expect(plan.summary?.verb).toBe('reacted with');
    expect(plan.sensitivity).toEqual({
      gated: true,
      label: 'Sensitive content',
      reason: 'spoiler',
      revealLabel: 'Reveal',
      showBadge: false,
    });

    const ungated = planEventContentCore(note, [], {
      hideSensitive: false,
      revealed: false,
      showSummary: false,
    });
    expect(ungated.summary).toBeUndefined();
    expect(ungated.sensitivity).toEqual({
      gated: false,
      label: 'Sensitive content',
      reason: 'spoiler',
      revealLabel: 'Reveal',
      showBadge: true,
    });
  });

  it('reveals retained sensitive content without bubbling into the row', () => {
    const calls: string[] = [];
    const revealed = revealEventContent(
      { stopPropagation: () => calls.push('stop') },
      () => calls.push('record'),
    );

    expect(revealed).toBe(true);
    expect(calls).toEqual(['stop', 'record']);
  });
});

function signedEvent(
  patch: Partial<Pick<NostrEvent, 'content' | 'kind' | 'tags'>> = {},
): NostrEvent {
  return finalizeEvent(
    {
      created_at: 1,
      kind: patch.kind ?? kinds.textNote,
      tags: patch.tags ?? [],
      content: patch.content ?? '',
    },
    generateSecretKey(),
  );
}

function rawEvent(patch: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 1,
    kind: kinds.textNote,
    tags: [],
    content: '',
    sig: 'c'.repeat(128),
    ...patch,
  };
}
