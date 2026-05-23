import { describe, expect, it } from 'vitest';
import { relayPageWindows } from '../../../src/lib/events/relay-page-windows';

const day = 24 * 60 * 60;

describe('relay page windows', () => {
  it('builds continuous older windows with a terminal since zero window', () => {
    const windows = relayPageWindows({
      direction: 'older',
      before: { createdAt: 2_000_000, id: 'a'.repeat(64) },
      now: 2_000_100,
    });

    expect(windows[0]).toEqual({
      since: 2_000_001 - 6 * 60 * 60,
      until: 2_000_001,
    });
    expect(windows.at(-1)?.since).toBe(0);
    for (let index = 1; index < windows.length; index += 1)
      expect(windows[index]?.until).toBe(windows[index - 1]!.since + 1);
  });

  it('starts old cursors with a 180 day span', () => {
    const windows = relayPageWindows({
      direction: 'older',
      before: { createdAt: 1_000_000, id: 'a'.repeat(64) },
      now: 1_000_000 + 40 * day,
    });

    expect(windows[0]?.since).toBe(1_000_001 - 180 * day);
  });

  it('bounds initial windows with since and until', () => {
    const windows = relayPageWindows({ direction: 'initial', now: 2_000_000 });

    expect(windows[0]).toEqual({
      since: 2_000_001 - 6 * 60 * 60,
      until: 2_000_001,
    });
    expect(windows.at(-1)?.since).toBe(0);
  });
});
