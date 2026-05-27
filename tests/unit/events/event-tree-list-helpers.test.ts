import { describe, expect, it } from 'vitest';
import type { FlatEventTreeItem } from '../../../src/lib/events/tree';
import {
  buildViewRows,
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
      false,
      '',
    );
    expect(rows.map(viewRowKey)).toEqual(['a', 'b']);
    expect(rows.map((row) => row.kind)).toEqual(['event', 'event']);
  });

  it('adds leading rows before events with stable keys', () => {
    const rows = buildViewRows(
      [{ key: 'profile-header' }, { key: 'profile-newer', nearStart: true }],
      [item('a')],
      false,
      false,
      false,
      '',
    );
    expect(rows.map(viewRowKey)).toEqual([
      'event-list-leading-profile-header',
      'event-list-leading-profile-newer',
      'a',
      'event-list-terminal',
    ]);
    expect(nearStartVisualIndex(rows)).toBe(1);
  });

  it('renders empty rows inside the same row model', () => {
    const rows = buildViewRows(
      [{ key: 'profile-header' }],
      [],
      false,
      true,
      false,
      'Nothing here.',
    );
    expect(rows.map((row) => row.kind)).toEqual(['leading', 'empty']);
    expect(viewRowKey(rows[1]!)).toBe('event-list-empty');
  });

  it('uses stable loading older row keys', () => {
    const rows = buildViewRows([], [item('a')], true, true, false, '');
    expect(rows.map(viewRowKey)).toEqual(['a', 'event-list-loading-older']);
  });
});
