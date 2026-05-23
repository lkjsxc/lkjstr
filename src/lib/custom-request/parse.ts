import { normalizeRelayUrl, parseFilter, type NostrFilter } from '$lib/protocol';

export type CustomRequest = {
  readonly filters: readonly NostrFilter[];
  readonly relays: readonly string[];
  readonly subId?: string;
};

export function parseCustomRequest(input: string): CustomRequest {
  const value = JSON.parse(input) as unknown;
  const request = parseValue(value);
  if (request.filters.length === 0) throw new Error('No valid filters found.');
  return request;
}

function parseValue(value: unknown): CustomRequest {
  if (Array.isArray(value) && value[0] === 'REQ') return parseReq(value);
  if (Array.isArray(value)) return { filters: parseFilters(value), relays: [] };
  if (isRecord(value) && ('filters' in value || 'filter' in value)) {
    const raw = 'filters' in value ? value.filters : value.filter;
    const filters = Array.isArray(raw) ? parseFilters(raw) : parseFilters([raw]);
    return { filters, relays: parseRelays(value.relays) };
  }
  return { filters: parseFilters([value]), relays: [] };
}

function parseReq(value: readonly unknown[]): CustomRequest {
  if (typeof value[1] !== 'string') throw new Error('REQ subId is invalid.');
  return { subId: value[1], filters: parseFilters(value.slice(2)), relays: [] };
}

function parseFilters(values: readonly unknown[]): NostrFilter[] {
  const filters = values.map(parseFilter);
  if (filters.some((filter) => !filter)) throw new Error('Filter is invalid.');
  return filters as NostrFilter[];
}

function parseRelays(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Relays must be an array.');
  const relays = value.map((relay) =>
    typeof relay === 'string' ? normalizeRelayUrl(relay) : undefined,
  );
  if (relays.some((relay) => !relay)) throw new Error('Relay URL is invalid.');
  return [...new Set(relays as string[])].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
