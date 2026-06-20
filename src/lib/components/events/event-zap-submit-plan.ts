const zapFailedStatus = 'Zap failed.';

export type EventZapSubmitStatePlan = {
  readonly busy: boolean;
  readonly clearInvoices: boolean;
  readonly status: string;
};

export type EventZapSubmitCallbacks<Invoice> = {
  readonly createInvoices: () => Promise<readonly Invoice[]>;
  readonly setBusy: (busy: boolean) => void;
  readonly setInvoices: (invoices: readonly Invoice[]) => void;
  readonly setStatus: (status: string) => void;
};

type EventZapSubmitEvent = {
  preventDefault(): void;
};

export function canSubmitEventZap(amountSats: number, busy: boolean): boolean {
  return !busy && amountSats >= 1;
}

export function submitEventZap(
  event: EventZapSubmitEvent,
  createInvoices: () => void,
): void {
  event.preventDefault();
  createInvoices();
}

export function eventZapInvoiceStatus(invoiceCount: number): string {
  return invoiceCount === 1 ? 'Invoice ready.' : 'Invoices ready.';
}

export function eventZapErrorStatus(error: unknown): string {
  return error instanceof Error ? error.message : zapFailedStatus;
}

export function eventZapSubmitStartPlan(): EventZapSubmitStatePlan {
  return { busy: true, clearInvoices: true, status: '' };
}

export function eventZapSubmitSuccessPlan(
  invoiceCount: number,
): EventZapSubmitStatePlan {
  return {
    busy: false,
    clearInvoices: false,
    status: eventZapInvoiceStatus(invoiceCount),
  };
}

export function eventZapSubmitErrorPlan(
  error: unknown,
): EventZapSubmitStatePlan {
  return {
    busy: false,
    clearInvoices: false,
    status: eventZapErrorStatus(error),
  };
}

export async function runEventZapSubmit<Invoice>(
  callbacks: EventZapSubmitCallbacks<Invoice>,
): Promise<void> {
  const start = eventZapSubmitStartPlan();
  callbacks.setBusy(start.busy);
  callbacks.setStatus(start.status);
  if (start.clearInvoices) callbacks.setInvoices([]);
  try {
    const invoices = await callbacks.createInvoices();
    callbacks.setInvoices(invoices);
    const result = eventZapSubmitSuccessPlan(invoices.length);
    callbacks.setBusy(result.busy);
    callbacks.setStatus(result.status);
  } catch (error) {
    const result = eventZapSubmitErrorPlan(error);
    callbacks.setBusy(result.busy);
    callbacks.setStatus(result.status);
  }
}
