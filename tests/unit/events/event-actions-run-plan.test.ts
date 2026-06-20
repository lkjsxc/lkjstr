import { describe, expect, it } from 'vitest';
import {
  eventActionErrorStatus,
  eventActionResultStatus,
  planEventActionError,
  planEventActionResult,
  planEventActionRunSettle,
  planEventActionRunStart,
} from '../../../src/lib/components/events/event-actions-run-plan';

describe('event action run plan', () => {
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
});
