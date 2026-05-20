import { parseRelayMessage, type RelayMessage } from '../protocol';

const maxRelayMessageBytes = 64 * 1024;

export type RelayMessageDataResult =
  | { readonly ok: true; readonly message: RelayMessage }
  | { readonly ok: false; readonly message: string };

export function parseRelayMessageData(
  data: unknown,
): RelayMessageDataResult | undefined {
  if (typeof data !== 'string') return undefined;
  if (data.length > maxRelayMessageBytes)
    return { ok: false, message: 'relay message too large' };
  const parsed = parseRelayMessage(data);
  return parsed.ok
    ? { ok: true, message: parsed.message }
    : { ok: false, message: parsed.message };
}
