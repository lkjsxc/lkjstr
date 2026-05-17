import { parseNostrEvent, type NostrEvent } from './event';
import { parseFilter, type NostrFilter } from './filter';

export type ClientMessage =
  | readonly ['EVENT', NostrEvent]
  | readonly ['REQ', string, ...NostrFilter[]]
  | readonly ['CLOSE', string];

export type RelayMessage =
  | readonly ['EVENT', string, NostrEvent]
  | readonly ['OK', string, boolean, string]
  | readonly ['EOSE', string]
  | readonly ['CLOSED', string, string]
  | readonly ['NOTICE', string]
  | readonly ['AUTH', string];

type MessageErrorCode = 'bad_json' | 'bad_shape' | 'bad_event' | 'bad_filter';

export type MessageParseResult =
  | { ok: true; message: RelayMessage }
  | {
      ok: false;
      code: MessageErrorCode;
      message: string;
    };

export function encodeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}

export function parseRelayMessage(raw: string): MessageParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail('bad_json', 'relay message is not valid JSON');
  }
  if (!Array.isArray(parsed) || typeof parsed[0] !== 'string')
    return fail('bad_shape', 'relay message must be an array');
  if (parsed[0] === 'EVENT') return parseRelayEvent(parsed);
  if (parsed[0] === 'OK')
    return typed(parsed, 4, ['string', 'boolean', 'string']);
  if (parsed[0] === 'EOSE') return typed(parsed, 2, ['string']);
  if (parsed[0] === 'CLOSED') return typed(parsed, 3, ['string', 'string']);
  if (parsed[0] === 'NOTICE') return typed(parsed, 2, ['string']);
  if (parsed[0] === 'AUTH') return typed(parsed, 2, ['string']);
  return fail('bad_shape', `unsupported relay message ${parsed[0]}`);
}

export function parseClientMessage(value: unknown): ClientMessage | undefined {
  if (!Array.isArray(value) || typeof value[0] !== 'string') return undefined;
  if (value[0] === 'EVENT' && value.length === 2) {
    const event = parseNostrEvent(value[1]);
    return event.ok ? ['EVENT', event.event] : undefined;
  }
  if (
    value[0] === 'CLOSE' &&
    value.length === 2 &&
    typeof value[1] === 'string'
  )
    return ['CLOSE', value[1]];
  if (value[0] === 'REQ' && value.length >= 3 && typeof value[1] === 'string') {
    const filters = value.slice(2).map(parseFilter);
    if (filters.some((filter) => !filter)) return undefined;
    return ['REQ', value[1], ...(filters as NostrFilter[])];
  }
  return undefined;
}

function parseRelayEvent(value: unknown[]): MessageParseResult {
  if (value.length !== 3 || typeof value[1] !== 'string')
    return fail('bad_shape', 'EVENT message shape is invalid');
  const event = parseNostrEvent(value[2]);
  if (!event.ok) return fail('bad_event', event.message);
  return { ok: true, message: ['EVENT', value[1], event.event] };
}

function typed(
  value: unknown[],
  length: number,
  types: readonly string[],
): MessageParseResult {
  if (value.length !== length)
    return fail('bad_shape', `${value[0]} message has invalid length`);
  for (const [index, type] of types.entries()) {
    if (typeof value[index + 1] !== type)
      return fail('bad_shape', `${value[0]} field ${index + 1} is invalid`);
  }
  return { ok: true, message: value as unknown as RelayMessage };
}

function fail(code: MessageErrorCode, message: string): MessageParseResult {
  return { ok: false, code, message };
}
