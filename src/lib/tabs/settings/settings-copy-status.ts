export type SettingsCopyStatus =
  | {
      readonly kind: 'copied';
      readonly label: string;
    }
  | {
      readonly kind: 'failed';
      readonly label: string;
      readonly reason: string;
    };

export type SettingsClipboard = {
  readonly writeText?: (value: string) => Promise<void>;
};

export async function copySettingsJson(
  label: string,
  value: string,
  clipboard: SettingsClipboard | undefined,
): Promise<SettingsCopyStatus> {
  if (!clipboard?.writeText) {
    return { kind: 'failed', label, reason: 'Clipboard unavailable' };
  }
  try {
    await clipboard.writeText(value);
    return { kind: 'copied', label };
  } catch (error) {
    return { kind: 'failed', label, reason: failureReason(error) };
  }
}

export function settingsCopyStatusText(status: SettingsCopyStatus): string {
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
