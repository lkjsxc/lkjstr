export type ProtectionReason = 'scan-limit' | 'storage-error';

export type ProtectionSnapshot = {
  readonly ids: Set<string>;
  readonly complete: boolean;
  readonly scannedRows: number;
  readonly reason?: ProtectionReason;
};

export type MutableProtectionSnapshot = {
  ids: Set<string>;
  complete: boolean;
  scannedRows: number;
  reason?: ProtectionReason;
};

export type ScanSource<T> = {
  readonly each: (visit: (row: T) => false | void) => Promise<void>;
};

export async function scanRows<T>(
  snapshot: MutableProtectionSnapshot,
  source: ScanSource<T>,
  limit: number,
  visit: (row: T) => void,
): Promise<void> {
  if (!snapshot.complete) return;
  try {
    await source.each((row) => {
      if (snapshot.scannedRows >= limit) {
        markIncomplete(snapshot, 'scan-limit');
        return false;
      }
      snapshot.scannedRows += 1;
      visit(row);
    });
  } catch {
    markIncomplete(snapshot, 'storage-error');
  }
}

function markIncomplete(
  snapshot: MutableProtectionSnapshot,
  reason: ProtectionReason,
): void {
  snapshot.complete = false;
  snapshot.reason ??= reason;
}
