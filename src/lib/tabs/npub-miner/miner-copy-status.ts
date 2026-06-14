export type MinerCopyStatus =
  | {
      readonly kind: 'copied';
      readonly label: string;
    }
  | {
      readonly kind: 'failed';
      readonly label: string;
      readonly reason: string;
    };

export type MinerClipboard = {
  readonly writeText?: (value: string) => Promise<void>;
};

export async function copyMinedValue(
  label: string,
  value: string,
  clipboard: MinerClipboard | undefined,
): Promise<MinerCopyStatus> {
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

export function minerCopyStatusText(status: MinerCopyStatus): string {
  if (status.kind === 'copied') {
    return `Copied ${status.label}.`;
  }
  return `Copy failed ${status.label}: ${status.reason}`;
}

function failureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Clipboard write failed';
}
