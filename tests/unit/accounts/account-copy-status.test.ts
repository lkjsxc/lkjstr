import { describe, expect, it } from 'vitest';
import {
  accountCopyStatusText,
  copyAccountSecret,
} from '../../../src/lib/tabs/accounts/account-copy-status';

describe('account copy status', () => {
  it('reports copied only after clipboard write succeeds', async () => {
    const clipboard = {
      writes: [] as string[],
      async writeText(value: string) {
        this.writes.push(value);
      },
    };
    const status = await copyAccountSecret('Local nsec', 'nsec1...', clipboard);

    expect(clipboard.writes).toEqual(['nsec1...']);
    expect(status).toEqual({ kind: 'copied', label: 'Local nsec' });
    expect(accountCopyStatusText(status)).toBe('Local nsec copied.');
  });

  it('reports unavailable clipboard without claiming copied status', async () => {
    const status = await copyAccountSecret('Local nsec', 'nsec1...', undefined);

    expect(status).toEqual({
      kind: 'failed',
      label: 'Local nsec',
      reason: 'Clipboard unavailable',
    });
    expect(accountCopyStatusText(status)).toBe(
      'Local nsec copy failed: Clipboard unavailable',
    );
  });

  it('reports clipboard rejection without claiming copied status', async () => {
    const status = await copyAccountSecret('Local nsec', 'nsec1...', {
      writeText: async () => {
        throw new Error('denied');
      },
    });

    expect(status).toEqual({
      kind: 'failed',
      label: 'Local nsec',
      reason: 'denied',
    });
    expect(accountCopyStatusText(status)).toBe(
      'Local nsec copy failed: denied',
    );
  });
});
