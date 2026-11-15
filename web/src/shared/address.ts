// Addresses as a person types them, tidied before they are handed to the engine (which decides whether they work).
const tidy = (text: string, scheme: string, allowed: readonly string[]): string | undefined => {
  const typed = text.trim();
  if (!typed || /\s/.test(typed)) return undefined;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(typed) ? typed : `${scheme}//${typed}`);
    if (!allowed.includes(u.protocol) || !u.hostname.includes('.') || u.username) return undefined;
    return `${u.protocol}//${u.host}${u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')}`;
  } catch {
    return undefined;
  }
};
/** `wss://host[/path]` from what was typed (`relay.example.jp` is enough); undefined when it is not an address. */
export const relayAddress = (text: string): string | undefined =>
  tidy(text, 'wss:', ['wss:', 'ws:']);
/** `https://host[/path]` of a media server. */
export const serverAddress = (text: string): string | undefined => tidy(text, 'https:', ['https:']);
/** The part of an address worth reading: the host, and the path when there is one. */
export const hostOf = (url: string): string => url.replace(/^[a-z]+:\/\//, '').replace(/\/$/, '');
