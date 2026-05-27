import { normalizeRelayUrl } from '../../protocol';

export type HomeQueryKeyInput = {
  readonly accountPubkey?: string | null;
  readonly relays: readonly string[];
  readonly pageSize: number;
  readonly feedPolicy?: string;
};

export function homeQueryKey(input: HomeQueryKeyInput): string {
  return JSON.stringify({
    account: input.accountPubkey ?? '',
    relays: normalizedRelays(input.relays),
    pageSize: input.pageSize,
    feedPolicy: input.feedPolicy ?? 'account-home',
  });
}

function normalizedRelays(relays: readonly string[]): string[] {
  return [
    ...new Set(
      relays
        .map(normalizeRelayUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ].sort();
}
