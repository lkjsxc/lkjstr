export function normalizeRelayUrl(input: string): string | undefined {
  const raw = input.includes('://') ? input : `wss://${input}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return undefined;
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+/g, '/');
  if (url.pathname.endsWith('/') && url.pathname !== '/')
    url.pathname = url.pathname.slice(0, -1);
  if (url.pathname === '/') url.pathname = '';
  url.searchParams.sort();
  return url.toString();
}
