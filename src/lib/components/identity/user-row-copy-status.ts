export type UserRowCopyStatus =
  | {
      readonly kind: 'copied';
    }
  | {
      readonly kind: 'failed';
      readonly reason: string;
    };

export type UserRowClipboard = {
  readonly writeText?: (value: string) => Promise<void>;
};

export async function copyUserRowNpub(
  npub: string,
  clipboard: UserRowClipboard | undefined,
): Promise<UserRowCopyStatus> {
  if (!clipboard?.writeText) {
    return userRowCopyFailure('Clipboard unavailable');
  }
  try {
    await clipboard.writeText(npub);
    return { kind: 'copied' };
  } catch (error) {
    return userRowCopyFailure(error);
  }
}

export function userRowCopyFailure(error: unknown): UserRowCopyStatus {
  return { kind: 'failed', reason: copyFailureReason(error) };
}

export function userRowCopyStatusText(status: UserRowCopyStatus): string {
  if (status.kind === 'copied') {
    return 'Copied npub.';
  }
  return `Copy failed npub: ${status.reason}`;
}

function copyFailureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return 'Clipboard write failed';
}
