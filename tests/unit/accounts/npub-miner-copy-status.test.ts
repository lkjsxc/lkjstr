import { describe, expect, it } from 'vitest';
import {
  copyMinedValue,
  minerCopyStatusText,
} from '../../../src/lib/tabs/npub-miner/miner-copy-status';

describe('npub miner copy status', () => {
  it('reports copied only after clipboard write succeeds', async () => {
    const clipboard = {
      writes: [] as string[],
      async writeText(value: string) {
        this.writes.push(value);
      },
    };
    const status = await copyMinedValue('nsec', 'nsec1...', clipboard);

    expect(clipboard.writes).toEqual(['nsec1...']);
    expect(status).toEqual({ kind: 'copied', label: 'nsec' });
    expect(minerCopyStatusText(status)).toBe('Copied nsec.');
  });

  it('reports unavailable clipboard without claiming copied status', async () => {
    const status = await copyMinedValue('npub', 'npub1...', undefined);

    expect(status).toEqual({
      kind: 'failed',
      label: 'npub',
      reason: 'Clipboard unavailable',
    });
    expect(minerCopyStatusText(status)).toBe(
      'Copy failed npub: Clipboard unavailable',
    );
  });

  it('reports clipboard rejection without claiming copied status', async () => {
    const status = await copyMinedValue('nsec', 'nsec1...', {
      writeText: async () => {
        throw new Error('denied');
      },
    });

    expect(status).toEqual({ kind: 'failed', label: 'nsec', reason: 'denied' });
    expect(minerCopyStatusText(status)).toBe('Copy failed nsec: denied');
  });
});
