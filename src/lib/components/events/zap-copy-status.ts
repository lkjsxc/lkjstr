export type ZapInvoiceCopyStatus =
  | {
      readonly kind: 'copied';
    }
  | {
      readonly kind: 'failed';
      readonly reason: string;
    };

export type ZapInvoiceClipboard = {
  readonly writeText?: (value: string) => Promise<void>;
};

export async function copyZapInvoice(
  invoice: string,
  clipboard: ZapInvoiceClipboard | undefined,
): Promise<ZapInvoiceCopyStatus> {
  if (!clipboard?.writeText) {
    return { kind: 'failed', reason: 'Clipboard unavailable' };
  }
  try {
    await clipboard.writeText(invoice);
    return { kind: 'copied' };
  } catch (error) {
    return { kind: 'failed', reason: copyFailureReason(error) };
  }
}

export function zapInvoiceCopyStatusText(status: ZapInvoiceCopyStatus): string {
  if (status.kind === 'copied') {
    return 'Invoice copied.';
  }
  return `Invoice copy failed: ${status.reason}`;
}

function copyFailureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Clipboard write failed';
}
