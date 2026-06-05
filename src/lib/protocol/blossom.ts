import type { NostrTag, UnsignedNostrEvent } from './event';
import { kinds } from './kinds';
import { validHttpsUrl } from './nip96';

export type BlossomBlobDescriptor = {
  readonly url: string;
  readonly sha256: string;
  readonly size?: number;
  readonly type?: string;
  readonly uploaded?: number;
  readonly tags: readonly NostrTag[];
  readonly imeta: NostrTag;
};

export function blossomUploadEndpoint(server: string): string | undefined {
  const url = validHttpsUrl(server.trim());
  if (!url) return undefined;
  const rootPath = url.pathname === '' || url.pathname === '/';
  return rootPath ? `${url.origin}/upload` : url.href;
}

export function blossomUploadAuthEvent(input: {
  readonly pubkey: string;
  readonly endpoint: string;
  readonly sha256: string;
  readonly size: number;
  readonly now?: number;
  readonly expiresInSeconds?: number;
}): UnsignedNostrEvent {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const expires = now + (input.expiresInSeconds ?? 600);
  return {
    pubkey: input.pubkey,
    created_at: now,
    kind: kinds.blossomAuth,
    tags: [
      ['t', 'upload'],
      ['x', input.sha256],
      ['u', input.endpoint],
      ['method', 'PUT'],
      ['size', String(input.size)],
      ['expiration', String(expires)],
    ],
    content: '',
  };
}

export function parseBlossomBlobDescriptor(input: {
  readonly value: unknown;
  readonly expectedHash: string;
  readonly fallbackUrl: string;
  readonly fallbackType?: string;
  readonly fallbackSize?: number;
}): BlossomBlobDescriptor | undefined {
  if (!record(input.value)) return undefined;
  const sha256 = hex64(input.value.sha256) ?? hex64(input.value.x);
  if (!sha256 || sha256 !== input.expectedHash) return undefined;
  const rawUrl = stringValue(input.value.url) ?? input.fallbackUrl;
  const parsedUrl = validHttpsUrl(rawUrl);
  if (!parsedUrl) return undefined;
  const size = numberValue(input.value.size) ?? input.fallbackSize;
  const type = stringValue(input.value.type) ?? input.fallbackType;
  const uploaded = numberValue(input.value.uploaded);
  const tags = descriptorTags(parsedUrl.href, sha256, size, type);
  return {
    url: parsedUrl.href,
    sha256,
    size,
    type,
    uploaded,
    tags,
    imeta: imetaTag(parsedUrl.href, tags),
  };
}

function descriptorTags(
  url: string,
  sha256: string,
  size?: number,
  type?: string,
): NostrTag[] {
  const tags: NostrTag[] = [
    ['url', url],
    ['x', sha256],
  ];
  if (type) tags.push(['m', type]);
  if (typeof size === 'number') tags.push(['size', String(size)]);
  return tags;
}

function imetaTag(url: string, tags: readonly NostrTag[]): NostrTag {
  const parts = [`url ${url}`];
  for (const name of ['m', 'x', 'size']) {
    const value = tags.find((tag) => tag[0] === name)?.[1];
    if (value) parts.push(`${name} ${value}`);
  }
  return ['imeta', ...parts];
}

function hex64(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
