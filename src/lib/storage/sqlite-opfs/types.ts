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

export type OpenDatabase = {
  readonly databaseName: string;
  readonly preferredVfs?: 'opfs' | 'opfs-sahpool';
  readonly allowSahpool?: boolean;
  readonly allowTransient?: boolean;
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
