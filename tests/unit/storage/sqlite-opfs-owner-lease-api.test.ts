import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  acquireSqliteOpfsOwnerLease,
  sqliteOwnerLockName,
} from '../../../src/lib/storage/sqlite-opfs/owner-lease';

describe('SQLite OPFS Web Locks owner lease', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('holds the exclusive Web Lock until release', async () => {
    let released = false;
    vi.stubGlobal('navigator', {
      locks: {
        request: async (
          name: string,
          options: unknown,
          callback: (lock: unknown) => Promise<void>,
        ) => {
          expect(name).toBe(sqliteOwnerLockName);
          expect(options).toMatchObject({
            mode: 'exclusive',
            ifAvailable: true,
          });
          await callback({ name });
          released = true;
        },
      },
    });

    const result = await acquireSqliteOpfsOwnerLease();

    expect(result.ok).toBe(true);
    expect(released).toBe(false);
    if (result.ok) result.lease.release();
    await Promise.resolve();
    expect(released).toBe(true);
  });

  test('reports busy when Web Lock ifAvailable returns null', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        request: async (
          _name: string,
          _options: unknown,
          callback: (lock: unknown) => void,
        ) => {
          callback(null);
        },
      },
    });

    const result = await acquireSqliteOpfsOwnerLease();

    expect(result).toMatchObject({
      ok: false,
      denied: {
        outcome: 'busy',
        diagnostics: { ownerReason: 'web-lock-held' },
      },
    });
  });

  test('adds browser-local holder diagnostics when a tab responds', async () => {
    vi.stubGlobal('BroadcastChannel', fakeBroadcastChannel());
    let calls = 0;
    vi.stubGlobal('navigator', {
      locks: {
        request: async (
          _name: string,
          _options: unknown,
          callback: (lock: unknown) => unknown,
        ) => {
          calls += 1;
          await callback(calls === 1 ? { name: sqliteOwnerLockName } : null);
        },
      },
    });

    const held = await acquireSqliteOpfsOwnerLease();
    const blocked = await acquireSqliteOpfsOwnerLease();

    expect(held.ok).toBe(true);
    expect(blocked).toMatchObject({
      ok: false,
      denied: { diagnostics: { ownerReason: 'web-lock-held' } },
    });
    if (!blocked.ok) {
      expect(blocked.denied.diagnostics.ownerHolderId).toMatch(/^owner-/);
      expect(blocked.denied.diagnostics.message).toContain(
        blocked.denied.diagnostics.ownerHolderId,
      );
    }
    if (held.ok) held.lease.release();
  });
});

type FakeChannel = {
  name: string;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  closed: boolean;
  postMessage(message: unknown): void;
  close(): void;
};

function fakeBroadcastChannel() {
  const channels: FakeChannel[] = [];
  function FakeChannel(this: FakeChannel, name: string) {
    this.name = name;
    this.onmessage = null;
    this.closed = false;
    channels.push(this);
  }
  FakeChannel.prototype.postMessage = function (
    this: FakeChannel,
    message: unknown,
  ) {
    for (const channel of channels) {
      if (channel === this || channel.closed || channel.name !== this.name)
        continue;
      queueMicrotask(() =>
        channel.onmessage?.({ data: message } as MessageEvent),
      );
    }
  };
  FakeChannel.prototype.close = function (this: FakeChannel) {
    this.closed = true;
  };
  return FakeChannel;
}
