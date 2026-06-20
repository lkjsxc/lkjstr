import { describe, expect, it } from 'vitest';
import { eventZapPanelLabels } from '../../../src/lib/components/events/event-zap-panel-plan';

describe('event zap panel plan', () => {
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
});
