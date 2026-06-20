import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const zapPanel = readFileSync(
  'src/lib/components/events/EventZapPanel.svelte',
  'utf8',
);
const invoiceRow = readFileSync(
  'src/lib/components/events/EventZapInvoiceRow.svelte',
  'utf8',
);

describe('event zap panel presenter wiring', () => {
  it('derives retained form labels, submit gating, and lifecycle helpers', () => {
    expect(zapPanel).toContain('const labels = eventZapPanelLabels();');
    expect(zapPanel).toContain('await runEventZapSubmit({');
    expect(zapPanel).toContain('createZapInvoices({');
    expect(zapPanel).toContain('amountSats: amount');
    expect(zapPanel).toContain('message,');
    expect(zapPanel).toContain(
      'submitEventZap(event, () => void createInvoices())',
    );
    expect(zapPanel).toContain('aria-label={labels.amountInput}');
    expect(zapPanel).toContain('aria-label={labels.messageInput}');
    expect(zapPanel).toContain('disabled={!canSubmitEventZap(amount, busy)}');
  });

  it('routes retained invoice copy, open, and row planning through helpers', () => {
    expect(zapPanel).toContain('copyEventZapInvoiceStatus(invoice, {');
    expect(zapPanel).toContain('clipboard: navigator.clipboard');
    expect(zapPanel).toContain('openEventZapInvoice(uri,');
    expect(zapPanel).toContain('return eventZapInvoiceRows(invoices, labels);');
    expect(zapPanel).toContain('{#if hasEventZapInvoices(invoices)}');
    expect(zapPanel).toContain(
      '<EventZapInvoiceRow row={invoice} {copyInvoice} {openInvoice} />',
    );
    expect(zapPanel).toContain('role="status"');
  });

  it('keeps retained zap invoice row chrome on planned row data', () => {
    expect(invoiceRow).toContain('src={props.row.qrDataUrl}');
    expect(invoiceRow).toContain('alt={props.row.qrAlt}');
    expect(invoiceRow).toContain('{props.row.amountLabel}');
    expect(invoiceRow).toContain('aria-label={props.row.openLabel}');
    expect(invoiceRow).toContain('title={props.row.copyLabel}');
    expect(invoiceRow).toContain(
      'onclick={() => props.openInvoice(props.row.uri)}',
    );
    expect(invoiceRow).toContain('void props.copyInvoice(props.row.invoice)');
  });
});
