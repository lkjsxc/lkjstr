import { describe, expect, it } from 'vitest';
import { relayPageWindows } from '../../../src/lib/events/relay-page-windows';

const day = 24 * 60 * 60;
const initialSpan = 12 * 60;

describe('relay page windows', () => {
  it('builds continuous older windows with a terminal since zero window', () => {
    const windows = relayPageWindows({
      direction: 'older',
      before: { createdAt: 2_000_000, id: 'a'.repeat(64) },
      now: 2_000_100,
    });

    expect(windows[0]).toEqual({
      since: 2_000_001 - initialSpan,
      until: 2_000_001,
    });
    expect(windows.at(-1)?.since).toBe(0);
    for (let index = 1; index < windows.length; index += 1) {
      const previous = windows[index - 1]!;
      expect(windows[index]?.until).toBe(previous.since! + 1);
    }
  });

  it('starts old cursors with the adaptive initial span', () => {
    const windows = relayPageWindows({
      direction: 'older',
      before: { createdAt: 20_000_000, id: 'a'.repeat(64) },
      now: 20_000_000 + 40 * day,
    });

    expect(windows[0]?.since).toBe(20_000_001 - initialSpan);
  });

  it('bounds initial windows with since and until', () => {
    const windows = relayPageWindows({ direction: 'initial', now: 2_000_000 });

    expect(windows[0]).toEqual({
      since: 2_000_001 - initialSpan,
      until: 2_000_001,
    });
    expect(windows.at(-1)?.since).toBe(0);
  });

  it('builds newer windows from now down toward the after cursor', () => {
    const windows = relayPageWindows({
      direction: 'newer',
      after: { createdAt: 1_000_000, id: 'a'.repeat(64) },
      now: 2_000_000,
    });

    expect(windows[0]).toEqual({
      since: 2_000_001 - initialSpan,
      until: 2_000_001,
    });
    expect(windows.at(-1)?.since).toBe(999_999);
    for (let index = 1; index < windows.length; index += 1) {
      const previous = windows[index - 1]!;
      expect(windows[index]?.until).toBe(previous.since! + 1);
    }
  });
});
