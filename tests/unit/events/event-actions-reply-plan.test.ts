import { describe, expect, it } from 'vitest';
import {
  canSubmitEventActionReply,
  eventActionReplyKeySubmits,
  submitEventActionReply,
  submitEventActionReplyShortcut,
} from '../../../src/lib/components/events/event-actions-reply-plan';

describe('event actions reply plan', () => {
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
});
