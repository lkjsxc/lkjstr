import { sqliteOwnerCooldownMs } from './owner-lease';
import type { StorageResponse } from './types';

type Cooldown = { readonly until: number; readonly response: StorageResponse };

let cooldown: Cooldown | undefined;

export function activeOwnerCooldown(): StorageResponse | undefined {
  if (!cooldown) return undefined;
  const retryAfterMs = Math.max(0, cooldown.until - Date.now());
  if (retryAfterMs <= 0) {
    cooldown = undefined;
    return undefined;
  }
  return withRetryAfter(cooldown.response, retryAfterMs);
}

export function startOwnerCooldown(response: StorageResponse): StorageResponse {
  const retryAfterMs = sqliteOwnerCooldownMs;
  const next = withRetryAfter(response, retryAfterMs);
  cooldown = { until: Date.now() + retryAfterMs, response: next };
  return next;
}

export function clearOwnerCooldown(): void {
  cooldown = undefined;
}

function withRetryAfter(
  response: StorageResponse,
  retryAfterMs: number,
): StorageResponse {
  return {
    ...response,
    diagnostics: { ...response.diagnostics, retryAfterMs },
  };
}
