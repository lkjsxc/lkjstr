import type { NostrEvent } from '$lib/protocol';
import { rustWasmDiagnosticMessage } from '$lib/rust-wasm/bridge-unavailable';
import type { FolloweeEntry } from '$lib/profile/followees';

export type FollowGraphBridgeSummary = {
  readonly entries: readonly FolloweeEntry[];
  readonly following_count: number;
};

export type FollowGraphBridgeResult =
  | { readonly ok: true; readonly summary: FollowGraphBridgeSummary }
  | { readonly ok: false; readonly message: string };

type WasmExports = {
  readonly follow_list_summary_json?: (eventJson: string) => unknown;
};

export async function rustFollowListSummary(
  event: NostrEvent,
): Promise<FollowGraphBridgeResult> {
  try {
    const module = await import('virtual:lkjstr-web-wasm');
    const exports = (await module.loadLkjstrWebWasm()) as WasmExports;
    return decodeBridgeResponse(
      exports.follow_list_summary_json?.(JSON.stringify(event)),
    );
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export function decodeBridgeResponse(value: unknown): FollowGraphBridgeResult {
  if (!isRecord(value)) return { ok: false, message: 'bridge unavailable' };
  if (value.ok === true && isRecord(value.data)) {
    return {
      ok: true,
      summary: {
        entries: Array.isArray(value.data.entries)
          ? value.data.entries.map(bridgeEntry)
          : [],
        following_count: Number(value.data.following_count ?? 0),
      },
    };
  }
  return {
    ok: false,
    message:
      typeof value.message === 'string' ? value.message : 'bridge failed',
  };
}

function bridgeEntry(value: unknown): FolloweeEntry {
  const entry = isRecord(value) ? value : {};
  return {
    pubkey: typeof entry.pubkey === 'string' ? entry.pubkey : '',
    relayUrl: stringField(entry.relayUrl) ?? stringField(entry.relay),
    petname: stringField(entry.petname),
  };
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
  return rustWasmDiagnosticMessage(error);
}
