import { describe, expect, it } from 'vitest';
import type { FlatEventTreeItem } from '../../../src/lib/events/tree';
import { buildViewRows } from '../../../src/lib/components/events/event-tree-list-helpers';
import {
  isRowNearStart,
  nearStartVisualIndex,
} from '../../../src/lib/components/events/event-tree-list-near-start-plan';

const item = (id: string) => ({ event: { id }, depth: 0 }) as FlatEventTreeItem;

describe('event tree list near-start plan', () => {
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
});

const offsetForRows = (index: number): number => index * 100;

const near = (delta: number): boolean => delta >= 0 && delta <= 40;
