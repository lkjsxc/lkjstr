import { describe, expect, it } from 'vitest';
import {
  copyEventIdToClipboard,
  copyEventStatusLabel,
} from '../../../src/lib/components/events/event-more-menu';

describe('event more menu clipboard', () => {
  it('reports copied only after clipboard write succeeds', async () => {
    const clipboard = {
      writes: [] as string[],
      async writeText(value: string) {
        this.writes.push(value);
      },
    };
    const status = await copyEventIdToClipboard('event-id', clipboard);

    expect(clipboard.writes).toEqual(['event-id']);
    expect(status).toEqual({ kind: 'copied' });
    expect(copyEventStatusLabel(status)).toBe('Copied');
  });

  it('reports unavailable clipboard without claiming success', async () => {
    const status = await copyEventIdToClipboard('event-id', undefined);

    expect(status).toEqual({
      kind: 'failed',
      reason: 'Clipboard unavailable',
    });
    expect(copyEventStatusLabel(status)).toBe(
      'Copy failed: Clipboard unavailable',
    );
  });

  it('reports clipboard rejection without claiming success', async () => {
    const status = await copyEventIdToClipboard('event-id', {
      writeText: async () => {
        throw new Error('denied');
      },
    });

    expect(status).toEqual({ kind: 'failed', reason: 'denied' });
    expect(copyEventStatusLabel(status)).toBe('Copy failed: denied');
  });
});
