import { incMemoryCounter, decMemoryCounter, setMemoryCounter } from '../app/memory-counters';

export const maxRelayQueuedMessages = 64;

export type RelaySendQueue = ReturnType<typeof createRelaySendQueue>;

export function createRelaySendQueue() {
  let messages: string[] = [];

  return {
    enqueue: (message: string): boolean => {
      if (messages.length >= maxRelayQueuedMessages) return false;
      messages.push(message);
      incMemoryCounter('pending-relay-send-queue');
      return true;
    },
    drain: (): string[] => {
      const out = messages;
      messages = [];
      decMemoryCounter('pending-relay-send-queue', out.length);
      return out;
    },
    hasPending: (): boolean => messages.length > 0,
    clear: (): void => {
      messages = [];
      setMemoryCounter('pending-relay-send-queue', 0);
    },
  };
}
