export type EventZapPanelLabels = {
  readonly amountInput: 'Zap amount sats';
  readonly copyInvoice: 'Copy invoice';
  readonly invoiceQrAlt: 'BOLT11 invoice QR code';
  readonly messageInput: 'Zap message';
  readonly openInvoice: 'Open invoice';
  readonly submit: 'Invoice';
};

export function eventZapPanelLabels(): EventZapPanelLabels {
  return {
    amountInput: 'Zap amount sats',
    copyInvoice: 'Copy invoice',
    invoiceQrAlt: 'BOLT11 invoice QR code',
    messageInput: 'Zap message',
    openInvoice: 'Open invoice',
    submit: 'Invoice',
  };
}
