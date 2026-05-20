import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { resolveActiveSigner } from '../accounts/signer';
import {
  httpAuthEvent,
  nostrAuthorizationHeader,
  parseNip96UploadResult,
  type Nip96UploadResult,
  type NostrTag,
} from '../protocol';
import { resolveUploadEndpoint, type Fetcher } from './endpoint';
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
  const result = parseUpload(await response.json());
  return {
    url: result.url,
    name: file.name,
    type: file.type,
    tags: result.tags.map((tag) => [...tag]),
    imeta: [...result.imeta],
  };
}

async function filePayloadHash(file: File): Promise<string> {
  return bytesToHex(sha256(new Uint8Array(await file.arrayBuffer())));
}

function parseUpload(value: unknown): Nip96UploadResult {
  const parsed = parseNip96UploadResult(value);
  if (!parsed) throw new Error('Upload response did not include media URL.');
  return parsed;
}
