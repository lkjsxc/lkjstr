// Mirrors only the mock contract's URL bounds; authoritative validation is native.
export function allowedAuthUrl(text: string): boolean {
  if (
    !text ||
    new TextEncoder().encode(text).length > 4096 ||
    /[\s\p{Cc}]/u.test(text) ||
    text.includes('\\')
  )
    return false;
  try {
    const url = new URL(text),
      authority = text.split('://')[1]?.split(/[/?#]/)[0];
    if (!authority || authority.includes('@') || url.username || url.password || !url.hostname)
      return false;
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && /^(127\.0\.0\.1|\[::1\])(:\d+)?$/.test(authority))
    );
  } catch {
    return false;
  }
}
