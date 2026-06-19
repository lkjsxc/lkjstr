import { describe, expect, it } from 'vitest';
import {
  canSubmitEventZap,
  eventZapErrorStatus,
  eventZapInvoiceStatus,
  eventZapInvoiceOpenTarget,
  eventZapPanelLabels,
  eventZapSubmitErrorPlan,
  eventZapSubmitStartPlan,
  eventZapSubmitSuccessPlan,
  openEventZapInvoice,
  submitEventZap,
  zapInvoiceAmountSats,
} from '../../../src/lib/components/events/event-zap-panel-plan';

describe('event zap panel plan', () => {
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

  it('plans retained form and invoice control labels', () => {
    expect(eventZapPanelLabels()).toEqual({
      amountInput: 'Zap amount sats',
      copyInvoice: 'Copy invoice',
      invoiceQrAlt: 'BOLT11 invoice QR code',
      messageInput: 'Zap message',
      openInvoice: 'Open invoice',
      submit: 'Invoice',
    });
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

  it('renders invoice millisats as whole sats', () => {
    expect(zapInvoiceAmountSats(21_999)).toBe(21);
    expect(zapInvoiceAmountSats(42_000)).toBe(42);
  });

  it('keeps retained invoice opener target explicit', () => {
    const opened: string[] = [];
    expect(eventZapInvoiceOpenTarget('lightning:invoice')).toEqual({
      url: 'lightning:invoice',
      target: '_blank',
    });

    openEventZapInvoice('lightning:invoice', (url, target) => {
      opened.push(`${url}|${target}`);
    });
    expect(opened).toEqual(['lightning:invoice|_blank']);
  });
});
