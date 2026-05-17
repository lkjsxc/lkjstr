import { decodeEntity } from '../protocol';

export type Account =
  | {
      readonly mode: 'readonly';
      readonly pubkey: string;
      readonly label: string;
    }
  | { readonly mode: 'nip07'; readonly pubkey: string; readonly label: string };

export function parseReadonlyAccount(input: string): Account | undefined {
  const trimmed = input.trim();
  const decoded = decodeEntity(trimmed);
  if (decoded?.type === 'npub') {
    return {
      mode: 'readonly',
      pubkey: decoded.data,
      label: shortKey(decoded.data),
    };
  }
  if (/^[0-9a-f]{64}$/.test(trimmed)) {
    return { mode: 'readonly', pubkey: trimmed, label: shortKey(trimmed) };
  }
  return undefined;
}

export function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}:${pubkey.slice(-6)}`;
}
