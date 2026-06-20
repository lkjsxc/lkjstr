import { describe, expect, it } from 'vitest';
import {
  eventZapInvoiceOpenTarget,
  eventZapInvoiceRows,
  hasEventZapInvoices,
  openEventZapInvoice,
  zapInvoiceAmountSats,
} from '../../../src/lib/components/events/event-zap-row-plan';

describe('event zap row plan', () => {
  it('renders invoice millisats as whole sats', () => {
    expect(zapInvoiceAmountSats(21_999)).toBe(21);
    expect(zapInvoiceAmountSats(42_000)).toBe(42);
  });

  it('plans retained invoice row state, labels, and stable keys', () => {
    expect(hasEventZapInvoices([])).toBe(false);
    expect(
      hasEventZapInvoices([{ invoice: 'lnbc1', amountMsats: 21_999 }]),
    ).toBe(true);

    expect(
      eventZapInvoiceRows([
        {
          amountMsats: 21_999,
          invoice: 'lnbc1',
          qrDataUrl: 'data:image/png;base64,qr',
          uri: 'lightning:lnbc1',
        },
      ]),
    ).toEqual([
      {
        amountLabel: '21 sats',
        copyLabel: 'Copy invoice',
        invoice: 'lnbc1',
        key: 'lnbc1',
        openLabel: 'Open invoice',
        qrAlt: 'BOLT11 invoice QR code',
        qrDataUrl: 'data:image/png;base64,qr',
        uri: 'lightning:lnbc1',
      },
    ]);
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
