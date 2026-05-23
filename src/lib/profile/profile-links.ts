import {
  normalizeRelayUrl,
  type CustomEmoji,
  type NostrEvent,
} from '$lib/protocol';
import type { RelaySet } from '$lib/relays/relay-store';

export type ProfileTextToken =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'url'; readonly href: string; readonly text: string }
  | {
      readonly type: 'custom-emoji';
      readonly shortcode: string;
      readonly url: string;
      readonly address?: string;
      readonly text: string;
    };

const profileTextPattern =
  /(:[A-Za-z0-9_]+:)|((?:[a-z][a-z0-9+.-]*:\/\/|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)[^\s<>"']+)/giu;

export function normalizedProfileWebsite(value?: string | null): string {
  const text = value?.trim();
  if (!text) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:/iu.test(text)
    ? text
    : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch {
    return '';
  }
}

export function tokenizeProfileText(
  content: string,
  emojis: readonly CustomEmoji[] = [],
): ProfileTextToken[] {
  const tokens: ProfileTextToken[] = [];
  const emojiByText = new Map(
    emojis.map((emoji) => [`:${emoji.shortcode}:`, emoji]),
  );
  let index = 0;
  for (const match of content.matchAll(profileTextPattern)) {
    const full = match[0] ?? '';
    const start = match.index ?? 0;
    if (start > index) pushProfileText(tokens, content.slice(index, start));
    index = start + full.length;
    if (match[1]) {
      const emoji = emojiByText.get(full);
      tokens.push(
        emoji
          ? { type: 'custom-emoji', text: full, ...emoji }
          : {
              type: 'text',
              text: full,
            },
      );
      continue;
    }
    const raw = cleanProfileUrlToken(full);
    const suffix = full.slice(raw.length);
    const href = normalizedProfileTextUrl(raw);
    pushProfileToken(tokens, href, raw);
    pushProfileText(tokens, suffix);
  }
  if (index < content.length) pushProfileText(tokens, content.slice(index));
  return mergeProfileText(tokens);
}

function normalizedProfileTextUrl(value: string): string {
  const text = value.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:/iu.test(text);
  if (hasScheme && !/^https?:\/\//iu.test(text)) return '';
  const href = normalizedProfileWebsite(text);
  if (!href) return '';
  if (!hasScheme && !new URL(href).hostname.includes('.')) return '';
  return href;
}

export function followingCount(followList?: NostrEvent | null): number {
  if (followList?.kind !== 3) return 0;
  return new Set(
    followList.tags
      .filter((tag) => tag[0] === 'p' && /^[0-9a-f]{64}$/iu.test(tag[1] ?? ''))
      .map((tag) => tag[1]!.toLowerCase()),
  ).size;
}

export function followListCopyJson(followList?: NostrEvent | null): string {
  return JSON.stringify(followList ?? null, null, 2);
}

export function relaySetsCopyJson(relaySets: readonly RelaySet[]): string {
  return JSON.stringify(
    relaySets.map((set) => ({
      id: set.id,
      name: set.name,
      default: Boolean(set.isDefault),
      relays: set.relays.map((relay) => ({
        url: normalizeRelayUrl(relay.url) ?? relay.url,
        enabled: relay.enabled,
        read: relay.read,
        write: relay.write,
      })),
    })),
    null,
    2,
  );
}

function cleanProfileUrlToken(value: string): string {
  return value.replace(/[),.;:!?]+$/u, '');
}

function pushProfileToken(
  tokens: ProfileTextToken[],
  href: string,
  text: string,
): void {
  tokens.push(href ? { type: 'url', href, text } : { type: 'text', text });
}

function pushProfileText(tokens: ProfileTextToken[], text: string): void {
  if (text) tokens.push({ type: 'text', text });
}

function mergeProfileText(
  tokens: readonly ProfileTextToken[],
): ProfileTextToken[] {
  return tokens.reduce<ProfileTextToken[]>((merged, token) => {
    const previous = merged.at(-1);
    if (previous?.type === 'text' && token.type === 'text') {
      merged[merged.length - 1] = {
        type: 'text',
        text: previous.text + token.text,
      };
      return merged;
    }
    merged.push(token);
    return merged;
  }, []);
}
