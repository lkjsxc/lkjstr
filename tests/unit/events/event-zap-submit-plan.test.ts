import { describe, expect, it } from 'vitest';
import {
  canSubmitEventZap,
  eventZapErrorStatus,
  eventZapInvoiceStatus,
  eventZapSubmitErrorPlan,
  eventZapSubmitStartPlan,
  eventZapSubmitSuccessPlan,
  submitEventZap,
} from '../../../src/lib/components/events/event-zap-submit-plan';

describe('event zap submit plan', () => {
  it('requires a positive zap amount and idle state before submit', () => {
    expect(canSubmitEventZap(0, false)).toBe(false);
    expect(canSubmitEventZap(1, true)).toBe(false);
    expect(canSubmitEventZap(1, false)).toBe(true);
  });

  it('prevents native form submit before creating retained zap invoices', () => {
    const calls: string[] = [];
    submitEventZap({ preventDefault: () => calls.push('prevent') }, () =>
      calls.push('create'),
    );

    expect(calls).toEqual(['prevent', 'create']);
  });

  it('preserves retained invoice status labels', () => {
    expect(eventZapInvoiceStatus(0)).toBe('Invoices ready.');
    expect(eventZapInvoiceStatus(1)).toBe('Invoice ready.');
    expect(eventZapInvoiceStatus(2)).toBe('Invoices ready.');
  });

  it('keeps zap error fallback explicit', () => {
    expect(eventZapErrorStatus(new Error('No lud16.'))).toBe('No lud16.');
    expect(eventZapErrorStatus('failed')).toBe('Zap failed.');
  });

  it('plans retained zap submit state transitions', () => {
    expect(eventZapSubmitStartPlan()).toEqual({
      busy: true,
      clearInvoices: true,
      status: '',
    });
    expect(eventZapSubmitSuccessPlan(1)).toEqual({
      busy: false,
      clearInvoices: false,
      status: 'Invoice ready.',
    });
    expect(eventZapSubmitErrorPlan(new Error('No lud16.'))).toEqual({
      busy: false,
      clearInvoices: false,
      status: 'No lud16.',
    });
  });
});
