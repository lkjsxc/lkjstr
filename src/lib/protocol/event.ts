export type NostrTag = readonly string[];

export type UnsignedNostrEvent = {
  readonly pubkey: string;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly NostrTag[];
  readonly content: string;
};

export type NostrEvent = UnsignedNostrEvent & {
  readonly id: string;
  readonly sig: string;
};

export type EventValidation =
  | { ok: true; event: NostrEvent }
  | {
      ok: false;
      code: 'not_object' | 'bad_field' | 'bad_tag';
      message: string;
    };

const hex64 = /^[0-9a-f]{64}$/;
const hex128 = /^[0-9a-f]{128}$/;

export function parseNostrEvent(value: unknown): EventValidation {
  if (!isRecord(value)) return fail('not_object', 'event must be an object');
  const base = parseUnsignedEvent(value);
  if (!base.ok) return base;
  if (!isHex(value.id, hex64))
    return fail('bad_field', 'id must be 32-byte lowercase hex');
  if (!isHex(value.sig, hex128))
    return fail('bad_field', 'sig must be 64-byte lowercase hex');
  return { ok: true, event: { ...base.event, id: value.id, sig: value.sig } };
}

export function parseUnsignedEvent(value: unknown):
  | { ok: true; event: UnsignedNostrEvent }
  | {
      ok: false;
      code: 'not_object' | 'bad_field' | 'bad_tag';
      message: string;
    } {
  if (!isRecord(value)) return fail('not_object', 'event must be an object');
  if (!isHex(value.pubkey, hex64))
    return fail('bad_field', 'pubkey must be 32-byte lowercase hex');
  if (!isUnixTime(value.created_at))
    return fail('bad_field', 'created_at must be a non-negative integer');
  if (!isKind(value.kind))
    return fail('bad_field', 'kind must be a non-negative integer');
  if (!Array.isArray(value.tags))
    return fail('bad_field', 'tags must be an array');
  if (typeof value.content !== 'string')
    return fail('bad_field', 'content must be a string');
  const tags = parseTags(value.tags);
  if (!tags.ok) return tags;
  return {
    ok: true,
    event: {
      pubkey: value.pubkey,
      created_at: value.created_at,
      kind: value.kind,
      tags: tags.tags,
      content: value.content,
    },
  };
}

export function compareEventsDesc(a: NostrEvent, b: NostrEvent): number {
  if (a.created_at !== b.created_at) return b.created_at - a.created_at;
  return a.id.localeCompare(b.id);
}

export function isEventId(value: string): boolean {
  return hex64.test(value);
}

export function isPubkey(value: string): boolean {
  return hex64.test(value);
}

function parseTags(
  value: unknown[],
):
  | { ok: true; tags: readonly NostrTag[] }
  | { ok: false; code: 'bad_tag'; message: string } {
  const tags: string[][] = [];
  for (const tag of value) {
    if (!Array.isArray(tag))
      return { ok: false, code: 'bad_tag', message: 'tag must be an array' };
    if (!tag.every((part) => typeof part === 'string')) {
      return {
        ok: false,
        code: 'bad_tag',
        message: 'tag entries must be strings',
      };
    }
    tags.push([...tag]);
  }
  return { ok: true, tags };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHex(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function isUnixTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isKind(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function fail(
  code: 'not_object' | 'bad_field',
  message: string,
): EventValidation {
  return { ok: false, code, message };
}
