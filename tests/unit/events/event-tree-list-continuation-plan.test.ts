import { describe, expect, it } from 'vitest';
import type { FlatEventTreeItem } from '../../../src/lib/events/tree';
import {
  continuationPlanForViewRow,
  openContinuationThread,
} from '../../../src/lib/components/events/event-tree-list-continuation-plan';

describe('event tree list continuation plan', () => {
  it('plans collapsed thread continuation rows without fake openers', () => {
    const row = {
      kind: 'event',
      node: collapsedItem('a'),
      visualIndex: 0,
    } as const;
    expect(continuationPlanForViewRow(row)).toEqual({
      visible: true,
      canOpenThread: false,
      depth: 5,
      hiddenCount: 2,
      targetId: 'a',
      buttonText: 'Continue thread (2)',
      unavailableText: '2 hidden thread item(s) unavailable.',
    });

    const opened: string[] = [];
    const open = (id: string) => opened.push(id);
    const openable = continuationPlanForViewRow(row, open);

    expect(openable).toMatchObject({ visible: true, canOpenThread: true });
    expect(openContinuationThread(openable, open)).toBe(true);
    expect(openContinuationThread(openable)).toBe(false);
    expect(openContinuationThread(continuationPlanForViewRow(row), open)).toBe(
      false,
    );
    expect(opened).toEqual(['a']);
  });

  it('hides continuation controls for ordinary rows', () => {
    expect(
      continuationPlanForViewRow({ kind: 'empty', text: 'Nothing.' }),
    ).toEqual({ visible: false });
  });
});

function collapsedItem(id: string): FlatEventTreeItem {
  return {
    ...realItem(id, ''),
    collapsed: true,
    depth: 5,
    hiddenCount: 2,
    targetId: id,
  } as FlatEventTreeItem;
}

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
