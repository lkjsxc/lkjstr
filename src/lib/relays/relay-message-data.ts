import { parseRelayMessage, type RelayMessage } from '../protocol';
import { utf8ByteLengthWithin } from './relay-message-size';

export type RelayMessageDataResult =
  | { readonly ok: true; readonly message: RelayMessage }
  | { readonly ok: false; readonly message: string };

export function parseRelayMessageData(
  data: unknown,
): RelayMessageDataResult | undefined {
  if (typeof data !== 'string')
    return {
      ok: false,
      message: unsupportedRelayFrameMessage(data),
    };
  const parsed = parseRelayMessage(data);
  return parsed.ok
    ? { ok: true, message: parsed.message }
    : { ok: false, message: parsed.message };
}

export function relayFrameBytes(data: unknown): number | undefined {
  if (typeof data === 'string')
    return utf8ByteLengthWithin(data, Number.MAX_SAFE_INTEGER).bytes;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data.size;
  return undefined;
}

function unsupportedRelayFrameMessage(data: unknown): string {
  const bytes = relayFrameBytes(data);
  return bytes === undefined
    ? 'unsupported non-text relay frame'
    : `unsupported non-text relay frame: ${bytes} bytes`;
}
