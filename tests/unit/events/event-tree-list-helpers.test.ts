import { describe, expect, it } from 'vitest';
import type { FlatEventTreeItem } from '../../../src/lib/events/tree';
import {
  buildViewRows,
  eventRows,
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
    expect(rows.map(viewRowKey)).toEqual(['event-list-leading-profile-header']);
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

  it('fragments oversized real event content into stable visual rows', () => {
    const rows = buildViewRows(
      [],
      [realItem('long', 'alpha beta\n\n'.repeat(260))],
      false,
      true,
      'unknown',
      false,
      '',
    );

    expect(rows[0]?.kind).toBe('eventFragment');
    expect(
      rows.map(viewRowKey).every((key) => key.includes('event:long')),
    ).toBe(true);
    expect(
      eventRows(rows)
        .map((row) => row.rowKey)
        .filter(Boolean).length,
    ).toBe(rows.length);
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

function realItem(id: string, content: string): FlatEventTreeItem {
  return {
    event: {
      id,
      pubkey: 'b'.repeat(64),
      created_at: 1,
      kind: 1,
      tags: [],
      content,
      sig: 'c'.repeat(128),
    },
    relays: ['wss://relay.example'],
    children: [],
    depth: 0,
  } as FlatEventTreeItem;
}
