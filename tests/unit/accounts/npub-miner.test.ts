import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeNpub } from '../../../src/lib/protocol';
import {
  createNpubMiner,
  estimatedAttempts,
  npubMatchesPrefix,
  parseNpubPrefix,
} from '../../../src/lib/accounts/npub-miner';

describe('npub miner helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes prefix input after npub1', () => {
    expect(parseNpubPrefix(' NPub1acd ')).toEqual({
      ok: true,
      prefix: 'acd',
    });
  });

  it('rejects empty, long, and invalid prefixes', () => {
    expect(parseNpubPrefix('')).toMatchObject({ ok: false });
    expect(parseNpubPrefix('a'.repeat(9))).toMatchObject({ ok: false });
    expect(parseNpubPrefix('bio')).toMatchObject({ ok: false });
  });

  it('matches encoded npub prefixes only after npub1', () => {
    const npub = encodeNpub('a'.repeat(64));
    expect(npubMatchesPrefix(npub, npub.slice(5, 7))).toBe(true);
    expect(npubMatchesPrefix(npub, 'zz')).toBe(false);
  });

  it('estimates cpu search size from bech32 alphabet length', () => {
    expect(estimatedAttempts('ab')).toBe(1024);
  });

  it('terminates the worker when a result arrives', () => {
    const workers = stubWorkers();
    const events: unknown[] = [];
    createNpubMiner('ab', (event) => events.push(event));

    workers[0]?.onmessage?.({
      data: {
        type: 'result',
        result: {
          attempts: 1,
          rate: 1,
          elapsedMs: 1,
          pubkey: 'a'.repeat(64),
          npub: 'npub1ab',
          nsec: 'nsec1',
        },
      },
    } as MessageEvent);

    expect(workers[0]?.terminated).toBe(true);
    expect(events).toHaveLength(1);
  });

  it('terminates the worker when an error arrives', () => {
    const workers = stubWorkers();
    const events: unknown[] = [];
    createNpubMiner('ab', (event) => events.push(event));

    workers[0]?.onerror?.({} as ErrorEvent);

    expect(workers[0]?.terminated).toBe(true);
    expect(events).toEqual([
      { type: 'error', message: 'Npub mining worker failed.' },
    ]);
  });

  it('ignores late result and error events after cancel', () => {
    const workers = stubWorkers();
    const events: unknown[] = [];
    const miner = createNpubMiner('ab', (event) => events.push(event));

    miner.cancel();
    workers[0]?.onmessage?.({
      data: {
        type: 'result',
        result: {
          attempts: 1,
          rate: 1,
          elapsedMs: 1,
          pubkey: 'a'.repeat(64),
          npub: 'npub1ab',
          nsec: 'nsec1',
        },
      },
    } as MessageEvent);
    workers[0]?.onerror?.({} as ErrorEvent);

    expect(events).toEqual([]);
    expect(workers[0]?.terminated).toBe(true);
  });
});

function stubWorkers(): FakeWorker[] {
  const workers: FakeWorker[] = [];
  vi.stubGlobal(
    'Worker',
    class extends FakeWorker {
      constructor() {
        super();
        workers.push(this);
      }
    },
  );
  return workers;
}

class FakeWorker {
  onmessage: ((message: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  messages: unknown[] = [];

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }
}
