import type { StorageDataClass } from './schema/table-spec';
import type { storageManifestGroup } from './schema/table-groups';

export type StorageGroup =
  | ReturnType<typeof storageManifestGroup>
  | 'non-indexed'
  | 'overhead'
  | 'unknown';

export type StorageInventoryStatus =
  | 'exact'
  | 'partial'
  | 'timeout'
  | 'unavailable'
  | 'unsupported';

export type StorageInventoryKind =
  | 'indexeddb-object-store'
  | 'indexeddb-database'
  | 'local-storage'
  | 'cache-storage'
  | 'residual-overhead';

export type StorageInventoryOwnership =
  | 'current-known-store'
  | 'legacy-protected'
  | 'legacy-recoverable'
  | 'unknown-unowned'
  | 'non-indexed'
  | 'residual-overhead';

export type StorageInventoryDataClass =
  | StorageDataClass
  | 'non-indexed-browser-storage'
  | 'unknown-legacy-or-unowned-storage'
  | 'residual-browser-overhead';

export type StorageInventoryRow = {
  readonly table: string;
  readonly database?: string;
  readonly objectStore?: string;
  readonly kind: StorageInventoryKind;
  readonly ownership: StorageInventoryOwnership;
  readonly dataClass?: StorageInventoryDataClass;
  readonly group: StorageGroup;
  readonly rowCount: number | null;
  readonly estimatedBytes: number;
  readonly status: StorageInventoryStatus;
  readonly scanDurationMs?: number;
  readonly reason?: string;
  readonly recoverable: boolean;
};

export type StorageInventoryOptions = {
  readonly storeDeadlineMs?: number;
  readonly totalDeadlineMs?: number;
  readonly now?: () => number;
};

export const defaultInventoryOptions = {
  storeDeadlineMs: 1000,
  totalDeadlineMs: 2500,
  now: () => Date.now(),
} satisfies Required<StorageInventoryOptions>;
