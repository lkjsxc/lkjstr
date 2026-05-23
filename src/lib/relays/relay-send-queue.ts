import { utf8ByteLengthWithin } from './relay-message-size';

export const maxRelayQueuedMessages = 64;
export const maxRelayQueuedBytes = 512 * 1024;

export class RelaySendQueue {
  #messages: string[] = [];
  #bytes = 0;

  enqueue(message: string): boolean {
    const bytes = utf8ByteLengthWithin(message, Number.MAX_SAFE_INTEGER).bytes;
    if (
      this.#messages.length >= maxRelayQueuedMessages ||
      this.#bytes + bytes > maxRelayQueuedBytes
    )
      return false;
    this.#messages.push(message);
    this.#bytes += bytes;
    return true;
  }

  drain(): string[] {
    const messages = this.#messages;
    this.#messages = [];
    this.#bytes = 0;
    return messages;
  }
}
