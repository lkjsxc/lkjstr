import { resolveActiveSigner } from '../accounts/signer';
import {
  httpAuthEvent,
  nip96DiscoveryUrl,
  nostrAuthorizationHeader,
  parseNip96Server,
  parseNip96UploadResult,
  validHttpsUrl,
  type Nip96UploadResult,
} from '../protocol';
import type { TweetAttachment } from './draft-store';
import type { TweetMediaUploadProvider } from './media-upload-providers';

export type UploadSettings = {
  readonly provider: TweetMediaUploadProvider;
  readonly customServer: string;
  readonly server: string;
  readonly noTransform: boolean;
};

export async function uploadTweetMedia(
  file: File,
  settings: UploadSettings,
): Promise<TweetAttachment> {
  if (!settings.server.trim()) throw new Error('Media upload is disabled.');
  const signer = await resolveActiveSigner();
  const endpoint = await uploadEndpoint(settings.server);
  const auth = await signer.signEvent(
    httpAuthEvent({
      pubkey: signer.account.pubkey,
      url: endpoint,
      method: 'POST',
    }),
  );
  const form = new FormData();
  form.set('file', file, file.name);
  if (settings.noTransform) form.set('no_transform', 'true');
  const response = await fetch(endpoint, {
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

async function uploadEndpoint(server: string): Promise<string> {
  const direct = validHttpsUrl(server);
  if (!direct) throw new Error('Media upload server must be HTTPS.');
  const discovery = nip96DiscoveryUrl(server);
  if (!discovery) return direct.href;
  const response = await fetch(discovery);
  if (!response.ok) return direct.href;
  const document = parseNip96Server(await response.json());
  return document?.delegatedToUrl ?? document?.apiUrl ?? direct.href;
}

function parseUpload(value: unknown): Nip96UploadResult {
  const parsed = parseNip96UploadResult(value);
  if (!parsed) throw new Error('Upload response did not include media URL.');
  return parsed;
}
