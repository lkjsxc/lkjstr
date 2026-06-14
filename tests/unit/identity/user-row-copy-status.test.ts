import { describe, expect, it } from 'vitest';
import {
  copyUserRowNpub,
  userRowCopyFailure,
  userRowCopyStatusText,
} from '../../../src/lib/components/identity/user-row-copy-status';

describe('user row npub copy status', () => {
  it('reports copied only after clipboard write succeeds', async () => {
    const clipboard = {
      writes: [] as string[],
      async writeText(value: string) {
        this.writes.push(value);
      },
    };
    const status = await copyUserRowNpub('npub1...', clipboard);

    expect(clipboard.writes).toEqual(['npub1...']);
    expect(status).toEqual({ kind: 'copied' });
    expect(userRowCopyStatusText(status)).toBe('Copied npub.');
  });

  it('reports unavailable clipboard without claiming copied status', async () => {
    const status = await copyUserRowNpub('npub1...', undefined);

    expect(status).toEqual({
      kind: 'failed',
      reason: 'Clipboard unavailable',
    });
    expect(userRowCopyStatusText(status)).toBe(
      'Copy failed npub: Clipboard unavailable',
    );
  });

  it('reports clipboard rejection without claiming copied status', async () => {
    const status = await copyUserRowNpub('npub1...', {
      writeText: async () => {
        throw new Error('denied');
      },
    });

    expect(status).toEqual({ kind: 'failed', reason: 'denied' });
    expect(userRowCopyStatusText(status)).toBe('Copy failed npub: denied');
  });

  it('maps callback failures to explicit copy failure status', () => {
    const status = userRowCopyFailure('callback rejected');

    expect(status).toEqual({ kind: 'failed', reason: 'callback rejected' });
    expect(userRowCopyStatusText(status)).toBe(
      'Copy failed npub: callback rejected',
    );
  });
});
