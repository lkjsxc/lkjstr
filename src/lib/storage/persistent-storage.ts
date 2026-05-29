export type StoragePersistenceState = {
  readonly supported: boolean;
  readonly persisted: boolean | null;
};

export type StoragePersistenceRequest = StoragePersistenceState & {
  readonly granted: boolean | null;
  readonly reason?: string;
};

export async function readStoragePersistenceState(): Promise<StoragePersistenceState> {
  const storage = currentStorage();
  if (!storage?.persisted) return { supported: false, persisted: null };
  try {
    return { supported: true, persisted: await storage.persisted() };
  } catch {
    return { supported: true, persisted: null };
  }
}

export async function requestStoragePersistence(): Promise<StoragePersistenceRequest> {
  const storage = currentStorage();
  if (!storage?.persisted || !storage.persist)
    return {
      supported: false,
      persisted: null,
      granted: null,
      reason: 'unsupported',
    };
  try {
    if (await storage.persisted())
      return { supported: true, persisted: true, granted: true };
    const granted = await storage.persist();
    return { supported: true, persisted: granted, granted };
  } catch {
    return {
      supported: true,
      persisted: null,
      granted: null,
      reason: 'failed',
    };
  }
}

function currentStorage():
  | {
      readonly persisted?: () => Promise<boolean>;
      readonly persist?: () => Promise<boolean>;
    }
  | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator.storage;
}
