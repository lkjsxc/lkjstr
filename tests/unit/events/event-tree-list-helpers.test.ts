import { describe, expect, it } from 'vitest';
import type { FlatEventTreeItem } from '../../../src/lib/events/tree';
import {
  buildViewRows,
  isRowNearStart,
  nearStartVisualIndex,
  viewRowKey,
} from '../../../src/lib/components/events/event-tree-list-helpers';

const item = (id: string) => ({ event: { id }, depth: 0 }) as FlatEventTreeItem;

describe('event tree list rows', () => {
  it('keeps non-profile event ordering unchanged', () => {
    const rows = buildViewRows(
      [],
      [item('a'), item('b')],
      false,
      true,
      'unknown',
      false,
      '',
    );
    expect(rows.map(viewRowKey)).toEqual(['a', 'b']);
    expect(rows.map((row) => row.kind)).toEqual(['event', 'event']);
  });

  it('adds leading rows before events with stable keys', () => {
    const rows = buildViewRows(
      [{ key: 'profile-header' }, { key: 'profile-error' }],
      [item('a')],
      false,
      false,
      'proven',
      false,
      '',
    );
    expect(rows.map(viewRowKey)).toEqual([
      'event-list-leading-profile-header',
      'event-list-leading-profile-error',
      'a',
      'event-list-terminal',
    ]);
    expect(nearStartVisualIndex(rows)).toBe(2);
  });

  it('uses the first marked leading row as the near-start target', () => {
    const rows = buildViewRows(
      [{ key: 'profile-header' }, { key: 'profile-banner', nearStart: true }],
      [item('a')],
      false,
      false,
      'proven',
      false,
      '',
    );
    expect(nearStartVisualIndex(rows)).toBe(1);
    expect(isRowNearStart(rows, 100, offsetForRows, near)).toBe(true);
  });

  it('falls back to the first event row when no leading row is marked', () => {
    const rows = buildViewRows(
      [{ key: 'profile-header' }],
      [item('a'), item('b')],
      false,
      false,
      'proven',
      false,
      '',
    );
    expect(nearStartVisualIndex(rows)).toBe(1);
    expect(isRowNearStart(rows, 100, offsetForRows, near)).toBe(true);
  });

  it('does not treat a profile header alone as the near-start target', () => {
    const rows = buildViewRows(
      [{ key: 'profile-header' }],
      [],
      false,
      true,
      'unknown',
      true,
      'Nothing here.',
    );
    expect(nearStartVisualIndex(rows)).toBeUndefined();
    expect(isRowNearStart(rows, 0, offsetForRows, near)).toBe(false);
  });

  it('renders empty rows inside the same row model', () => {
    const rows = buildViewRows(
      [{ key: 'profile-header' }],
      [],
      false,
      true,
      'unknown',
      false,
      'Nothing here.',
    );
    expect(rows.map((row) => row.kind)).toEqual(['leading', 'empty']);
    expect(viewRowKey(rows[1]!)).toBe('event-list-empty');
  });

  it('uses stable loading older row keys', () => {
    const rows = buildViewRows(
      [],
      [item('a')],
      true,
      true,
      'unknown',
      false,
      '',
    );
    expect(rows.map(viewRowKey)).toEqual(['a', 'event-list-loading-older']);
  });
});

function offsetForRows(index: number): number {
  return index * 100;
}

function near(delta: number): boolean {
  return delta >= 0 && delta <= 40;
}
