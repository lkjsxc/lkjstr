export const maxRelayQueuedMessages = 64;

export type RelaySendQueue = ReturnType<typeof createRelaySendQueue>;

export function createRelaySendQueue() {
  let messages: string[] = [];

  return {
    enqueue: (message: string): boolean => {
      if (messages.length >= maxRelayQueuedMessages) return false;
      messages.push(message);
      return true;
    },
    drain: (): string[] => {
      const out = messages;
      messages = [];
      return out;
    },
    hasPending: (): boolean => messages.length > 0,
    clear: (): void => {
      messages = [];
    },
  };
}
