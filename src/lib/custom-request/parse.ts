import {
  normalizeRelayUrl,
  parseFilter,
  type NostrFilter,
} from '$lib/protocol';
import { utf8ByteLengthWithin } from '$lib/relays/relay-message-size';

export type CustomRequest = {
  readonly filters: readonly NostrFilter[];
  readonly relays: readonly string[];
  readonly subId?: string;
};

const maxJsonBytes = 64 * 1024;
const maxFilters = 8;
const maxRelays = 32;
const maxValues = 500;
const maxSearchBytes = 256;
const maxLimit = 500;

export function parseCustomRequest(input: string): CustomRequest {
  const size = utf8ByteLengthWithin(input, maxJsonBytes);
  if (!size.within)
    throw new Error(`Request JSON exceeds ${maxJsonBytes} bytes.`);
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
    const filters = Array.isArray(raw)
      ? parseFilters(raw)
      : parseFilters([raw]);
    return { filters, relays: parseRelays(value.relays) };
  }
  return { filters: parseFilters([value]), relays: [] };
}

function parseReq(value: readonly unknown[]): CustomRequest {
  if (typeof value[1] !== 'string') throw new Error('REQ subId is invalid.');
  return { subId: value[1], filters: parseFilters(value.slice(2)), relays: [] };
}

function parseFilters(values: readonly unknown[]): NostrFilter[] {
  if (values.length > maxFilters)
    throw new Error(`At most ${maxFilters} filters are allowed.`);
  const filters = values.map(parseFilter);
  if (filters.some((filter) => !filter)) throw new Error('Filter is invalid.');
  return (filters as NostrFilter[]).map(clampFilter);
}

function parseRelays(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Relays must be an array.');
  if (value.length > maxRelays)
    throw new Error(`At most ${maxRelays} relays are allowed.`);
  const relays = value.map((relay) =>
    typeof relay === 'string' ? normalizeRelayUrl(relay) : undefined,
  );
  if (relays.some((relay) => !relay)) throw new Error('Relay URL is invalid.');
  return [...new Set(relays as string[])].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampFilter(filter: NostrFilter): NostrFilter {
  if (filter.ids && filter.ids.length > maxValues)
    throw new Error(`Filter ids are limited to ${maxValues} values.`);
  if (filter.authors && filter.authors.length > maxValues)
    throw new Error(`Filter authors are limited to ${maxValues} values.`);
  if (
    filter.search &&
    !utf8ByteLengthWithin(filter.search, maxSearchBytes).within
  )
    throw new Error(`Filter search is limited to ${maxSearchBytes} bytes.`);
  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith('#') && Array.isArray(value) && value.length > maxValues)
      throw new Error(`Filter ${key} values are limited to ${maxValues}.`);
  }
  return filter.limit && filter.limit > maxLimit
    ? { ...filter, limit: maxLimit }
    : filter;
}
