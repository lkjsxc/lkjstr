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
    this.onmessage?.({ data: translateSubId(this, data) } as MessageEvent);
  }
}

export function parsedSocketMessage(subId: string, exact = false): unknown {
  const raw = sockets
    .flatMap((socket) => socket.sent)
    .find((item) => {
      const parsed = JSON.parse(item) as unknown[];
      if (exact ? parsed[1] === subId : String(parsed[1]).startsWith(subId))
        return true;
      return actualSubIdFromSent(sockets, subId) === parsed[1];
    });
  return raw ? JSON.parse(raw) : undefined;
}

export function socketForSub(subId: string): FakeWebSocket | undefined {
  return sockets.find((socket) =>
    socket.sent.some((item) => {
      const actual = (JSON.parse(item) as unknown[])[1];
      return actual === subId || actualSubId(socket, subId) === actual;
    }),
  );
}

function translateSubId(socket: FakeWebSocket, data: unknown): unknown {
  if (typeof data !== 'string') return data;
  try {
    const message = JSON.parse(data) as unknown[];
    if (!['EVENT', 'EOSE', 'CLOSED'].includes(String(message[0]))) return data;
    const actual = actualSubId(socket, String(message[1]));
    return actual
      ? JSON.stringify([message[0], actual, ...message.slice(2)])
      : data;
  } catch {
    return data;
  }
}

function actualSubIdFromSent(
  sockets: readonly FakeWebSocket[],
  logical: string,
): string | undefined {
  return sockets.map((socket) => actualSubId(socket, logical)).find(Boolean);
}

function actualSubId(
  socket: FakeWebSocket,
  logical: string,
): string | undefined {
  const messages = socket.sent.map((item) => JSON.parse(item) as unknown[]);
  const direct = messages.find((item) => item[1] === logical)?.[1];
  return (direct as string | undefined) ?? logicalMatch(messages, logical);
}

function logicalMatch(
  messages: unknown[][],
  logical: string,
): string | undefined {
  const hit = messages.find((item) => {
    const filter = item[2] as Record<string, unknown> | undefined;
    const kinds = Array.isArray(filter?.kinds) ? filter.kinds : [];
    if (logical.endsWith(':follows')) return kinds.includes(3);
    if (logical.endsWith(':meta')) return kinds.includes(0);
    if (logical.includes(':notes:initial'))
      return kinds.includes(1) && filter?.until !== undefined;
    if (logical.endsWith(':notes'))
      return kinds.includes(1) && filter?.until === undefined;
    return false;
  });
  return hit?.[1] as string | undefined;
}
