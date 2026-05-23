import { normalizeRelayUrl } from '../protocol';

export function normalizedRelayList(relays: readonly string[]): string[] {
  return [
    ...new Set(
      relays
        .map(normalizeRelayUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ];
}
