import {
  eventZapPanelLabels,
  type EventZapPanelLabels,
} from './event-zap-panel-plan';

export type EventZapInvoiceRowInput = {
  readonly amountMsats: number;
  readonly invoice: string;
  readonly qrDataUrl: string;
  readonly uri: string;
};

export type EventZapInvoiceRowPlan = {
  readonly amountLabel: string;
  readonly copyLabel: EventZapPanelLabels['copyInvoice'];
  readonly invoice: string;
  readonly key: string;
  readonly openLabel: EventZapPanelLabels['openInvoice'];
  readonly qrAlt: EventZapPanelLabels['invoiceQrAlt'];
  readonly qrDataUrl: string;
  readonly uri: string;
};

export type EventZapInvoiceOpenAction = (
  url: string,
  target: string,
) => unknown;

export function zapInvoiceAmountSats(amountMsats: number): number {
  return Math.floor(amountMsats / 1000);
}

export function hasEventZapInvoices(invoices: readonly unknown[]): boolean {
  return invoices.length > 0;
}

export function eventZapInvoiceRows(
  invoices: readonly EventZapInvoiceRowInput[],
  labels: EventZapPanelLabels = eventZapPanelLabels(),
): readonly EventZapInvoiceRowPlan[] {
  return invoices.map((invoice) => eventZapInvoiceRow(invoice, labels));
}

export function eventZapInvoiceRow(
  invoice: EventZapInvoiceRowInput,
  labels: EventZapPanelLabels = eventZapPanelLabels(),
): EventZapInvoiceRowPlan {
  return {
    amountLabel: `${zapInvoiceAmountSats(invoice.amountMsats)} sats`,
    copyLabel: labels.copyInvoice,
    invoice: invoice.invoice,
    key: invoice.invoice,
    openLabel: labels.openInvoice,
    qrAlt: labels.invoiceQrAlt,
    qrDataUrl: invoice.qrDataUrl,
    uri: invoice.uri,
  };
}

export function eventZapInvoiceOpenTarget(uri: string): {
  readonly url: string;
  readonly target: string;
} {
  return { url: uri, target: '_blank' };
}

export function openEventZapInvoice(
  uri: string,
  open: EventZapInvoiceOpenAction,
): void {
  const target = eventZapInvoiceOpenTarget(uri);
  open(target.url, target.target);
}
