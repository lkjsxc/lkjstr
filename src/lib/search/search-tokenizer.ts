import type { NostrEvent } from '$lib/protocol';

export type SearchTokenRow = {
  readonly eventId: string;
  readonly token: string;
  readonly position: number;
  readonly createdAt: number;
  readonly kind: number;
  readonly pubkey: string;
};

const tokenPattern = /[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*/gu;
const maxTokenLength = 64;
const maxEventTokens = 512;
const maxQueryTokens = 16;

export function normalizeSearchText(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

export function tokenizeSearchText(text: string): string[] {
  return [...normalizeSearchText(text).matchAll(tokenPattern)]
    .map((match) => match[0]?.slice(0, maxTokenLength) ?? '')
    .filter(Boolean);
}

export function tokenizeSearchQuery(query: string): string[] {
  return [...new Set(tokenizeSearchText(query))].slice(0, maxQueryTokens);
}

export function eventSearchTokenRows(event: NostrEvent): SearchTokenRow[] {
  return tokenizeSearchText(event.content)
    .slice(0, maxEventTokens)
    .map((token, position) => ({
      eventId: event.id,
      token,
      position,
      createdAt: event.created_at,
      kind: event.kind,
      pubkey: event.pubkey,
    }));
}
