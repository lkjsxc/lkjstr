export type AccountCopyStatus =
  | {
      readonly kind: 'copied';
      readonly label: string;
    }
  | {
      readonly kind: 'failed';
      readonly label: string;
      readonly reason: string;
    };

export type AccountClipboard = {
  readonly writeText?: (value: string) => Promise<void>;
};

export async function copyAccountSecret(
  label: string,
  value: string,
  clipboard: AccountClipboard | undefined,
): Promise<AccountCopyStatus> {
  const writeText = clipboard?.writeText;
  if (!writeText) {
    return { kind: 'failed', label, reason: 'Clipboard unavailable' };
  }
  try {
    await writeText(value);
    return { kind: 'copied', label };
  } catch (error) {
    return { kind: 'failed', label, reason: failureReason(error) };
  }
}

export function accountCopyStatusText(status: AccountCopyStatus): string {
  if (status.kind === 'copied') {
    return `${status.label} copied.`;
  }
  return `${status.label} copy failed: ${status.reason}`;
}

function failureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Clipboard write failed';
}
