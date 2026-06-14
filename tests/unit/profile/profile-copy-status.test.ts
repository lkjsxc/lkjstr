import { describe, expect, it } from 'vitest';
import {
  copyProfileValue,
  profileCopyStatusLabel,
} from '../../../src/lib/tabs/profile/profile-copy-status';

describe('profile copy status', () => {
  it('reports copied only after clipboard write succeeds', async () => {
    const clipboard = {
      writes: [] as string[],
      async writeText(value: string) {
        this.writes.push(value);
      },
    };
    const status = await copyProfileValue('npub', 'npub1...', clipboard);

    expect(clipboard.writes).toEqual(['npub1...']);
    expect(status).toEqual({ kind: 'copied', label: 'npub' });
    expect(profileCopyStatusLabel(status)).toBe('Copied npub');
  });

  it('reports unavailable clipboard without claiming copied status', async () => {
    const status = await copyProfileValue(
      'nprofile',
      'nprofile1...',
      undefined,
    );

    expect(status).toEqual({
      kind: 'failed',
      label: 'nprofile',
      reason: 'Clipboard unavailable',
    });
    expect(profileCopyStatusLabel(status)).toBe(
      'Copy failed nprofile: Clipboard unavailable',
    );
  });

  it('reports clipboard rejection without claiming copied status', async () => {
    const status = await copyProfileValue('relays', '[]', {
      writeText: async () => {
        throw new Error('denied');
      },
    });

    expect(status).toEqual({
      kind: 'failed',
      label: 'relays',
      reason: 'denied',
    });
    expect(profileCopyStatusLabel(status)).toBe('Copy failed relays: denied');
  });
});
