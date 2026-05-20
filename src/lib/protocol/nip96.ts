import type { NostrTag } from './event';

export type Nip96Server = {
  readonly apiUrl: string;
  readonly delegatedToUrl?: string;
};

export type Nip96UploadResult = {
  readonly url: string;
  readonly tags: readonly NostrTag[];
  readonly imeta: NostrTag;
};

export function nip96DiscoveryUrl(server: string): string | undefined {
  const url = validHttpsUrl(server);
  if (!url) return undefined;
  return `${url.origin}/.well-known/nostr/nip96.json`;
}

export function parseNip96Server(value: unknown): Nip96Server | undefined {
  if (!record(value)) return undefined;
  const delegatedToUrl = stringValue(value.delegated_to_url);
  const apiUrl = stringValue(value.api_url) ?? stringValue(value.url);
  if (!apiUrl && delegatedToUrl)
    return { apiUrl: delegatedToUrl, delegatedToUrl };
  return apiUrl ? { apiUrl, delegatedToUrl } : undefined;
}

export function parseNip96UploadResult(
  value: unknown,
): Nip96UploadResult | undefined {
  if (!record(value)) return undefined;
  const tags = nip94Tags(value);
  const url = findTag(tags, 'url') ?? stringValue(value.url);
  if (!url) return undefined;
  return { url, tags, imeta: imetaTag(url, tags) };
}

export function validHttpsUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

function nip94Tags(value: Record<string, unknown>): NostrTag[] {
  const event = record(value.nip94_event) ? value.nip94_event : undefined;
  const source = Array.isArray(event?.tags) ? event.tags : value.tags;
  if (!Array.isArray(source)) return [];
  return source.filter(isStringArray);
}

function imetaTag(url: string, tags: readonly NostrTag[]): NostrTag {
  const parts = [`url ${url}`];
  for (const name of ['m', 'dim', 'blurhash', 'x', 'size']) {
    const value = findTag(tags, name);
    if (value) parts.push(`${name} ${value}`);
  }
  return ['imeta', ...parts];
}

function findTag(tags: readonly NostrTag[], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
