const sqliteOwnerChannelName = 'lkjstr.sqlite-opfs-owner';

export type SqliteOwnerCoordinationLease = {
  readonly holderId: string;
  close: () => void;
};

type OwnerMessage =
  | { readonly kind: 'who-holds' }
  | { readonly kind: 'held'; readonly holderId: string }
  | { readonly kind: 'released'; readonly holderId: string };

type BroadcastChannelLike = {
  onmessage: ((event: MessageEvent<OwnerMessage>) => void) | null;
  postMessage(message: OwnerMessage): void;
  close(): void;
};

type BroadcastChannelConstructor = new (name: string) => BroadcastChannelLike;

let pageHolderId: string | undefined;

export function announceSqliteOwnerHeld(): SqliteOwnerCoordinationLease {
  const holderId = ownerHolderId();
  const channel = openChannel();
  if (!channel) return { holderId, close: () => undefined };
  let closed = false;
  channel.onmessage = (event) => {
    if (event.data?.kind === 'who-holds')
      channel.postMessage({ kind: 'held', holderId });
  };
  channel.postMessage({ kind: 'held', holderId });
  return {
    holderId,
    close: () => {
      if (closed) return;
      closed = true;
      channel.postMessage({ kind: 'released', holderId });
      channel.close();
    },
  };
}

export function lookupSqliteOwnerHolder(
  timeoutMs = 75,
): Promise<string | undefined> {
  const channel = openChannel();
  if (!channel) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (holderId: string | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.close();
      resolve(holderId);
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    channel.onmessage = (event) => {
      if (event.data?.kind === 'held') finish(event.data.holderId);
    };
    channel.postMessage({ kind: 'who-holds' });
  });
}

function ownerHolderId(): string {
  pageHolderId ??= stableHolderId();
  return pageHolderId;
}

function stableHolderId(): string {
  const cryptoLike = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoLike?.randomUUID === 'function')
    return `owner-${cryptoLike.randomUUID()}`;
  return `owner-${Date.now().toString(36)}`;
}

function openChannel(): BroadcastChannelLike | undefined {
  const Channel = (
    globalThis as { BroadcastChannel?: BroadcastChannelConstructor }
  ).BroadcastChannel;
  if (typeof Channel !== 'function') return undefined;
  try {
    return new Channel(sqliteOwnerChannelName);
  } catch {
    return undefined;
  }
}
