type ProtectedStorageDiagnostics = {
  readonly storageOwner?: string;
  readonly ownerReason?: string;
  readonly ownerHolderId?: string;
  readonly retryAfterMs?: number | null;
  readonly message?: string;
};

type ProtectedStorageResponse = {
  readonly outcome: string;
  readonly diagnostics: ProtectedStorageDiagnostics;
};

export type ProtectedStorageState = {
  readonly kind: 'busy' | 'unavailable';
  readonly reason: string;
  readonly message: string;
  readonly retryAfterMs?: number | null;
  readonly ownerHolderId?: string;
};

export type ProtectedStorageError = Error & {
  readonly name: 'ProtectedStorageError';
  readonly state: ProtectedStorageState;
  readonly response: ProtectedStorageResponse;
};

export function throwIfProtectedStorageBlocked(
  response: ProtectedStorageResponse,
): void {
  const state = protectedStorageStateFromResponse(response);
  if (state) throw protectedStorageError(state, response);
}

export function protectedStorageStateFromError(
  error: unknown,
): ProtectedStorageState | undefined {
  return isProtectedStorageError(error) ? error.state : undefined;
}

function protectedStorageError(
  state: ProtectedStorageState,
  response: ProtectedStorageResponse,
): ProtectedStorageError {
  return Object.assign(new Error(state.message), {
    name: 'ProtectedStorageError' as const,
    state,
    response,
  });
}

function isProtectedStorageError(
  error: unknown,
): error is ProtectedStorageError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { readonly name?: unknown }).name === 'ProtectedStorageError'
  );
}

function protectedStorageStateFromResponse(
  response: ProtectedStorageResponse,
): ProtectedStorageState | undefined {
  const diagnostics = response.diagnostics;
  if (response.outcome === 'busy' || diagnostics.storageOwner === 'busy')
    return state('busy', diagnostics);
  if (diagnostics.ownerReason === 'web-lock-unavailable')
    return state('unavailable', diagnostics);
  return undefined;
}

function state(
  kind: ProtectedStorageState['kind'],
  diagnostics: ProtectedStorageDiagnostics,
): ProtectedStorageState {
  return {
    kind,
    reason: diagnostics.ownerReason ?? diagnostics.storageOwner ?? kind,
    message: diagnostics.message ?? defaultMessage(kind),
    retryAfterMs: diagnostics.retryAfterMs,
    ownerHolderId: diagnostics.ownerHolderId,
  };
}

function defaultMessage(kind: ProtectedStorageState['kind']): string {
  return kind === 'busy'
    ? 'Protected storage is busy in another tab.'
    : 'Protected storage is unavailable in this browser.';
}
