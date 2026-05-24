import { utf8ByteLengthWithin } from './relay-message-size';

export const maxRelayQueuedMessages = 64;
export const maxRelayQueuedBytes = 512 * 1024;

export type RelaySendQueue = ReturnType<typeof createRelaySendQueue>;

export function createRelaySendQueue() {
  let messages: string[] = [];
  let bytes = 0;

  return {
    enqueue: (message: string): boolean => {
      const size = utf8ByteLengthWithin(message, Number.MAX_SAFE_INTEGER).bytes;
      if (
        messages.length >= maxRelayQueuedMessages ||
        bytes + size > maxRelayQueuedBytes
      )
        return false;
      messages.push(message);
      bytes += size;
      return true;
    },
    drain: (): string[] => {
      const out = messages;
      messages = [];
      bytes = 0;
      return out;
    },
    hasPending: (): boolean => messages.length > 0,
  };
}
