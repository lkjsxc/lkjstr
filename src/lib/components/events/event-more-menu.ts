export type EventMoreMenuCopyStatus =
  | {
      readonly kind: 'copied';
    }
  | {
      readonly kind: 'failed';
      readonly reason: string;
    };

export type EventMoreMenuClipboard = {
  readonly writeText?: (value: string) => Promise<void>;
};

export type EventMoreMenuAuthorContextAction =
  | ((eventId: string, pubkey: string) => void)
  | undefined;

export function eventMoreMenuHasAuthorContext(
  action: EventMoreMenuAuthorContextAction,
): action is (eventId: string, pubkey: string) => void {
  return typeof action === 'function';
}

export async function copyEventIdToClipboard(
  eventId: string,
  clipboard: EventMoreMenuClipboard | undefined,
): Promise<EventMoreMenuCopyStatus> {
  if (!clipboard?.writeText) {
    return { kind: 'failed', reason: 'Clipboard unavailable' };
  }
  try {
    await clipboard.writeText(eventId);
    return { kind: 'copied' };
  } catch (error) {
    return { kind: 'failed', reason: copyFailureReason(error) };
  }
}

export function copyEventStatusLabel(status: EventMoreMenuCopyStatus): string {
  if (status.kind === 'copied') {
    return 'Copied';
  }
  return `Copy failed: ${status.reason}`;
}

function copyFailureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Clipboard write failed';
}
