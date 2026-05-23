import { parseRelayMessage, type RelayMessage } from '../protocol';
import {
  maxRelayMessageBytes,
  utf8ByteLengthWithin,
} from './relay-message-size';

export type RelayMessageDataResult =
  | { readonly ok: true; readonly message: RelayMessage }
  | { readonly ok: false; readonly message: string };

export function parseRelayMessageData(
  data: unknown,
): RelayMessageDataResult | undefined {
  if (typeof data !== 'string') return undefined;
  const size = utf8ByteLengthWithin(data, maxRelayMessageBytes);
  if (!size.within)
    return {
      ok: false,
      message: `relay message too large: ${size.bytes} bytes exceeds ${maxRelayMessageBytes} byte limit`,
    };
  const parsed = parseRelayMessage(data);
  return parsed.ok
    ? { ok: true, message: parsed.message }
    : { ok: false, message: parsed.message };
}
