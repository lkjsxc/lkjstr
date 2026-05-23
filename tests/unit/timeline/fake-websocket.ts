export const sockets: FakeWebSocket[] = [];

export class FakeWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    sockets.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.onclose?.({} as CloseEvent);
  }

  open(): void {
    this.onopen?.({} as Event);
  }

  receive(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

export function parsedSocketMessage(subId: string, exact = false): unknown {
  const raw = sockets
    .flatMap((socket) => socket.sent)
    .find((item) => {
      const parsed = JSON.parse(item) as unknown[];
      return exact ? parsed[1] === subId : String(parsed[1]).startsWith(subId);
    });
  return raw ? JSON.parse(raw) : undefined;
}

export function socketForSub(subId: string): FakeWebSocket | undefined {
  return sockets.find((socket) =>
    socket.sent.some((item) => (JSON.parse(item) as unknown[])[1] === subId),
  );
}
