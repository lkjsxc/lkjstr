import {
  nip96DiscoveryUrl,
  parseNip96Server,
  validHttpsUrl,
} from '../protocol';

export type Fetcher = typeof fetch;

export async function resolveUploadEndpoint(
  server: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const direct = validHttpsUrl(server.trim());
  if (!direct) throw new Error('Media upload server must be HTTPS.');
  return discoverEndpoint(direct.href, fetcher, new Set());
}

async function discoverEndpoint(
  server: string,
  fetcher: Fetcher,
  seen: Set<string>,
): Promise<string> {
  const direct = validHttpsUrl(server);
  if (!direct) throw new Error('Media upload server must be HTTPS.');
  if (seen.has(direct.origin)) return direct.href;
  seen.add(direct.origin);

  const discovery = nip96DiscoveryUrl(direct.href);
  if (!discovery) return direct.href;
  const response = await fetcher(discovery).catch(() => undefined);
  if (!response?.ok) return direct.href;

  const document = parseNip96Server(await response.json());
  const delegated = validEndpoint(document?.delegatedToUrl);
  if (delegated && !seen.has(delegated.origin))
    return discoverEndpoint(delegated.href, fetcher, seen);

  return validEndpoint(document?.apiUrl)?.href ?? direct.href;
}

function validEndpoint(value: string | undefined): URL | undefined {
  return value ? validHttpsUrl(value) : undefined;
}
