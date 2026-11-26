export type NostrLink = { route: 'n' | 'p' | 'a'; ref: string };

export const LKJSTR_ORIGIN = 'https://lkjstr.lkjsxc.com';
const LKJSTR_HOST = new URL(LKJSTR_ORIGIN).hostname;

const REFERENCE = /^(?:nostr:)?((note|nevent|npub|nprofile|naddr)1[a-z0-9]{1,4990})$/i;

function pointer(text: string): NostrLink | undefined {
  const [, ref, hrp] = REFERENCE.exec(text) ?? [];
  if (!ref || !hrp) return;
  const prefix = hrp.toLowerCase();
  const route = prefix.startsWith('np') ? 'p' : prefix === 'naddr' ? 'a' : 'n';
  return { route, ref };
}

export function nostrLinkPath(path: string, external = false): NostrLink | undefined {
  const [, prefix, segment] =
    /^\/(?:(n|p|a|e|note|notes|event|events|profile|people|article|articles)\/)?([^/]+)\/?$/.exec(
      path,
    ) ?? [];
  if (!segment) return;
  let ref: string;
  try {
    ref = decodeURIComponent(segment);
  } catch {
    return;
  }
  const link = pointer(ref);
  if (!prefix || external || prefix === link?.route) return link;
}

export function pastedNostrLink(input: string): NostrLink | undefined {
  const text = input.trim();
  if (!/^https?:\/\//i.test(text)) return pointer(text);
  try {
    const url = new URL(text);
    if (url.username || url.password) return;
    return nostrLinkPath(url.pathname, url.hostname !== LKJSTR_HOST);
  } catch {
    return;
  }
}
