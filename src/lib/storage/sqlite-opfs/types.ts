export type SqlScalar = string | number | bigint | null | Uint8Array;
export type SqlParams = readonly SqlScalar[] | Record<string, SqlScalar>;
export type SqlRow = Record<string, SqlScalar>;

export type StorageOutcome =
  | 'ok'
  | 'unavailable'
  | 'timeout'
  | 'busy'
  | 'blocked'
  | 'quota'
  | 'corrupt'
  | 'canceled'
  | 'late-settled'
  | 'late-rejected';

export type BatchMode = 'readwrite' | 'readonly';
export type StorageMode = 'persistent-opfs' | 'temporary-memory';
export type StorageOwnerState = 'active' | 'busy' | 'unavailable' | 'temporary';
export type StorageOwnerReason =
  | 'web-lock-granted'
  | 'web-lock-held'
  | 'web-lock-unavailable'
  | 'sahpool-lock-conflict'
  | 'browser-unsupported'
  | 'worker-construction-failed'
  | 'worker-open-failed'
  | 'sqlite-open-failed'
  | 'storage-blocked';
export type WorkerKind = 'dedicated' | 'shared' | 'unknown';
export type VfsName = 'opfs-sahpool' | 'opfs-wl' | 'opfs' | 'memory';

export type OpenDatabase = {
  readonly databaseName: string;
  readonly preferredVfs?: VfsName;
  readonly allowSahpool?: boolean;
  readonly allowOpfs?: boolean;
  readonly allowTransient?: boolean;
  readonly forceMemory?: boolean;
  readonly workerKind?: WorkerKind;
  readonly ownerReason?: StorageOwnerReason;
};

export type StorageHealth = {
  readonly mode: StorageMode;
  readonly vfsName: VfsName;
  readonly workerKind: WorkerKind;
  readonly sqliteVersion: string;
  readonly databaseName: string;
  readonly appliedSchemaChanges: readonly string[];
  readonly pageCount: number;
  readonly pageSize: number;
  readonly freelistCount: number;
  readonly eventCount: number;
  readonly relayReceiptCount: number;
  readonly tagRowCount: number;
  readonly lastIntegrityCheckAt: number | null;
  readonly warnings: readonly string[];
};

export type SqlStep = {
  readonly statement: string;
  readonly params?: SqlParams;
};

export type StorageOp =
  | { readonly kind: 'open'; readonly database: OpenDatabase }
  | { readonly kind: 'close' }
  | {
      readonly kind: 'apply-schema';
      readonly schemaHash: string;
      readonly statements: readonly string[];
    }
  | {
      readonly kind: 'execute';
      readonly statement: string;
      readonly params?: SqlParams;
    }
  | {
      readonly kind: 'query';
      readonly statement: string;
      readonly params?: SqlParams;
      readonly rowLimit: number;
    }
  | { readonly kind: 'get-storage-health' }
  | { readonly kind: 'read-physical-inventory' }
  | {
      readonly kind: 'batch';
      readonly mode: BatchMode;
      readonly steps: readonly SqlStep[];
    }
  | { readonly kind: 'estimate-storage' }
  | { readonly kind: 'cancel'; readonly targetRequestId: string };

export type StorageRequest = {
  readonly requestId: string;
  readonly deadlineMs: number;
  readonly op: StorageOp;
};

export type StorageDiagnostics = {
  readonly databaseName?: string;
  readonly vfs?: string;
  readonly vfsName?: VfsName;
  readonly mode?: StorageMode;
  readonly workerKind?: WorkerKind;
  readonly storageOwner?: StorageOwnerState;
  readonly ownerReason?: StorageOwnerReason;
  readonly ownerHolderId?: string;
  readonly retryAfterMs?: number | null;
  readonly sqliteVersion?: string;
  readonly warnings?: readonly string[];
  readonly health?: StorageHealth;
  readonly message?: string;
  readonly storageUsageBytes?: number;
  readonly storageQuotaBytes?: number;
};

export type StorageResponse = {
  readonly requestId: string;
  readonly outcome: StorageOutcome;
  readonly rows: readonly SqlRow[];
  readonly rowsAffected: number;
  readonly diagnostics: StorageDiagnostics;
};
