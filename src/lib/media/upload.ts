import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { resolveActiveSigner } from '../accounts/signer';
import {
  blossomUploadAuthEvent,
  httpAuthEvent,
  nostrAuthorizationHeader,
  parseBlossomBlobDescriptor,
  parseNip96UploadResult,
  type BlossomBlobDescriptor,
  type Nip96UploadResult,
  type NostrTag,
} from '../protocol';
import {
  resolveBlossomUploadEndpoint,
  resolveUploadEndpoint,
  type Fetcher,
} from './endpoint';
import type { UploadSettings } from './settings';

export type MediaUploadOptions = {
  readonly fetcher?: Fetcher;
  readonly includePayloadHash?: boolean;
};

export type UploadedMedia = {
  readonly url: string;
  readonly name: string;
  readonly type: string;
  readonly tags: readonly NostrTag[];
  readonly imeta: NostrTag;
};

export async function uploadMediaFile(
  file: File,
  settings: UploadSettings,
  options: MediaUploadOptions = {},
): Promise<UploadedMedia> {
  if (!settings.server.trim()) throw new Error('Media upload is disabled.');
  return settings.protocol === 'blossom'
    ? uploadBlossomMedia(file, settings, options.fetcher ?? fetch)
    : uploadNip96Media(file, settings, options);
}

async function uploadNip96Media(
  file: File,
  settings: UploadSettings,
  options: MediaUploadOptions,
): Promise<UploadedMedia> {
  const fetcher = options.fetcher ?? fetch;
  const signer = await resolveActiveSigner();
  const endpoint = await resolveUploadEndpoint(settings.server, fetcher);
  const payloadHash = options.includePayloadHash
    ? await filePayloadHash(file)
    : undefined;
  const auth = await signer.signEvent(
    httpAuthEvent({
      pubkey: signer.account.pubkey,
      url: endpoint,
      method: 'POST',
      payloadHash,
    }),
  );
  const form = new FormData();
  form.set('file', file, file.name);
  if (settings.noTransform) form.set('no_transform', 'true');
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { Authorization: nostrAuthorizationHeader(auth) },
    body: form,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return uploaded(file, parseNip96(await response.json()));
}

async function uploadBlossomMedia(
  file: File,
  settings: UploadSettings,
  fetcher: Fetcher,
): Promise<UploadedMedia> {
  const signer = await resolveActiveSigner();
  const endpoint = resolveBlossomUploadEndpoint(settings.server);
  const hash = await filePayloadHash(file);
  const auth = await signer.signEvent(
    blossomUploadAuthEvent({
      pubkey: signer.account.pubkey,
      endpoint,
      sha256: hash,
      size: file.size,
    }),
  );
  const response = await fetcher(endpoint, {
    method: 'PUT',
    headers: blossomHeaders(file, auth),
    body: file,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return uploaded(
    file,
    parseBlossom(
      await response.json(),
      hash,
      fallbackBlobUrl(endpoint, hash),
      file,
    ),
  );
}

async function filePayloadHash(file: File): Promise<string> {
  return bytesToHex(sha256(new Uint8Array(await file.arrayBuffer())));
}

function parseNip96(value: unknown): Nip96UploadResult {
  const parsed = parseNip96UploadResult(value);
  if (!parsed) throw new Error('Upload response did not include media URL.');
  return parsed;
}

function parseBlossom(
  value: unknown,
  expectedHash: string,
  fallbackUrl: string,
  file: File,
): BlossomBlobDescriptor {
  const parsed = parseBlossomBlobDescriptor({
    value,
    expectedHash,
    fallbackUrl,
    fallbackType: file.type,
    fallbackSize: file.size,
  });
  if (!parsed) throw new Error('Blossom response did not match uploaded blob.');
  return parsed;
}

function uploaded(
  file: File,
  result: Nip96UploadResult | BlossomBlobDescriptor,
): UploadedMedia {
  return {
    url: result.url,
    name: file.name,
    type: file.type,
    tags: result.tags.map((tag) => [...tag]),
    imeta: [...result.imeta],
  };
}

function blossomHeaders(file: File, auth: unknown): HeadersInit {
  return {
    Authorization: nostrAuthorizationHeader(auth),
    'Content-Type': file.type || 'application/octet-stream',
  };
}

function fallbackBlobUrl(endpoint: string, hash: string): string {
  return `${new URL(endpoint).origin}/${hash}`;
}
