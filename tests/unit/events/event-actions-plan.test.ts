import { describe, expect, it } from 'vitest';
import type { RelaySet } from '../../../src/lib/relays/relay-store';
import {
  canSubmitEventActionReply,
  eventActionLabels,
  eventActionReplyKeySubmits,
  eventActionErrorStatus,
  eventActionResultStatus,
  planCustomEmojiEventReaction,
  planEventActionEmojiSource,
  planEventActionError,
  planEventActionResult,
  planEventActionRunSettle,
  planEventActionRunStart,
  planUnicodeEventReaction,
  submitEventActionReply,
  submitEventActionReplyShortcut,
  toggleEventActionMode,
} from '../../../src/lib/components/events/event-actions-plan';

describe('event actions plan', () => {
  it('toggles inline action modes without opening duplicate panels', () => {
    expect(toggleEventActionMode('none', 'reply')).toBe('reply');
    expect(toggleEventActionMode('reply', 'reply')).toBe('none');
    expect(toggleEventActionMode('reply', 'zap')).toBe('zap');
  });

  it('keeps publish result and error status text explicit', () => {
    expect(eventActionResultStatus({ ok: true })).toBe('');
    expect(
      eventActionResultStatus({ ok: false, message: 'Relay denied.' }),
    ).toBe('Relay denied.');
    expect(eventActionResultStatus({ ok: false })).toBe('Action failed.');
    expect(eventActionErrorStatus(new Error('Signer rejected.'))).toBe(
      'Signer rejected.',
    );
    expect(eventActionErrorStatus('denied')).toBe('Action failed.');
  });

  it('plans retained action completion state and callbacks', () => {
    expect(planEventActionResult('reply', { ok: true })).toEqual({
      mode: 'none',
      status: '',
      success: true,
    });
    expect(
      planEventActionResult('zap', { ok: false, message: 'Relay denied.' }),
    ).toEqual({
      mode: 'zap',
      status: 'Relay denied.',
      success: false,
    });
    expect(
      planEventActionError('reply', new Error('Signer rejected.')),
    ).toEqual({
      mode: 'reply',
      status: 'Signer rejected.',
      success: false,
    });
  });

  it('plans retained action run busy state', () => {
    expect(planEventActionRunStart()).toEqual({
      busy: true,
      status: '',
    });
    expect(planEventActionRunSettle(false)).toEqual({
      apply: true,
      busy: false,
    });
    expect(planEventActionRunSettle(true)).toEqual({
      apply: false,
      busy: false,
    });
  });

  it('plans retained action button and reply labels', () => {
    expect(eventActionLabels()).toEqual({
      heart: 'Heart',
      publishReply: 'Publish reply',
      reply: 'Reply',
      repost: 'Repost',
      zap: 'Zap',
    });
  });

  it('requires non-blank replies and idle state before submit', () => {
    expect(canSubmitEventActionReply('', false)).toBe(false);
    expect(canSubmitEventActionReply('   ', false)).toBe(false);
    expect(canSubmitEventActionReply('gm', true)).toBe(false);
    expect(canSubmitEventActionReply(' gm ', false)).toBe(true);
  });

  it('keeps retained reply keyboard submit on control enter only', () => {
    expect(eventActionReplyKeySubmits({ ctrlKey: true, key: 'Enter' })).toBe(
      true,
    );
    expect(eventActionReplyKeySubmits({ ctrlKey: false, key: 'Enter' })).toBe(
      false,
    );
    expect(eventActionReplyKeySubmits({ ctrlKey: true, key: ' ' })).toBe(false);
  });

  it('prevents native form submit before dispatching retained replies', () => {
    const calls: string[] = [];
    submitEventActionReply(
      { preventDefault: () => calls.push('prevent') },
      () => calls.push('submit'),
    );

    expect(calls).toEqual(['prevent', 'submit']);
  });

  it('dispatches retained reply keyboard submits only on control enter', () => {
    let submits = 0;
    expect(
      submitEventActionReplyShortcut({ ctrlKey: true, key: 'Enter' }, () => {
        submits += 1;
      }),
    ).toBe(true);
    expect(
      submitEventActionReplyShortcut({ ctrlKey: false, key: 'Enter' }, () => {
        submits += 1;
      }),
    ).toBe(false);

    expect(submits).toBe(1);
  });

  it('plans unicode and custom emoji reaction payloads', () => {
    const custom = { shortcode: 'party', url: 'https://emoji.example/p.png' };

    expect(planUnicodeEventReaction('+')).toEqual({ content: '+' });
    expect(planCustomEmojiEventReaction(custom)).toEqual({
      content: ':party:',
      emoji: custom,
    });
  });

  it('plans emoji loading with account identity and selected read relays', () => {
    const plan = planEventActionEmojiSource('pubkey', [
      relaySet([
        relay('wss://relay-b.example', { read: true }),
        relay('wss://relay-c.example', { read: false }),
        relay('relay-a.example', { read: true }),
      ]),
    ]);

    expect(plan).toEqual({
      key: 'pubkey|wss://relay-a.example/\u0000wss://relay-b.example/',
      pubkey: 'pubkey',
      relays: ['wss://relay-a.example/', 'wss://relay-b.example/'],
    });
  });

  it('keeps anonymous emoji source plans explicit', () => {
    expect(planEventActionEmojiSource(null, []).key).toBe('|');
    expect(planEventActionEmojiSource(null, []).pubkey).toBeUndefined();
  });
});

function relaySet(relays: RelaySet['relays']): RelaySet {
  return {
    id: 'selected',
    name: 'Selected',
    purpose: 'user',
    seeded: false,
    relays,
    updatedAt: 1,
  };
}

function relay(
  url: string,
  options: Partial<RelaySet['relays'][number]> = {},
): RelaySet['relays'][number] {
  return {
    url,
    label: url,
    enabled: true,
    read: true,
    write: true,
    state: 'idle',
    health: { attempts: 0, successes: 0, failures: 0 },
    updatedAt: 1,
    ...options,
  };
}
