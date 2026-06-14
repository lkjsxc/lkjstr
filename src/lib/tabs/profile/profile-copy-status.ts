export type ProfileCopyStatus =
  | {
      readonly kind: 'copied';
      readonly label: string;
    }
  | {
      readonly kind: 'failed';
      readonly label: string;
      readonly reason: string;
    };

export type ProfileClipboard = {
  readonly writeText?: (value: string) => Promise<void>;
};

export async function copyProfileValue(
  label: string,
  value: string,
  clipboard: ProfileClipboard | undefined,
): Promise<ProfileCopyStatus> {
  const writeText = clipboard?.writeText;
  if (!writeText) {
    return { kind: 'failed', label, reason: 'Clipboard unavailable' };
  }
  try {
    await writeText(value);
    return { kind: 'copied', label };
  } catch (error) {
    return { kind: 'failed', label, reason: copyFailureReason(error) };
  }
}

export function profileCopyStatusLabel(status: ProfileCopyStatus): string {
  if (status.kind === 'copied') {
    return `Copied ${status.label}`;
  }
  return `Copy failed ${status.label}: ${status.reason}`;
}

function copyFailureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Clipboard write failed';
}
