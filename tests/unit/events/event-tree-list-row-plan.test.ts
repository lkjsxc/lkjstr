import { describe, expect, it } from 'vitest';
import type { FeedVisualFragment } from '../../../src/lib/feed-surface/feed-visual-fragments';
import type { EventActionState } from '../../../src/lib/events/action-state';
import type { FlatEventTreeItem } from '../../../src/lib/events/tree';
import type { ProfileSummary } from '../../../src/lib/identity/identity';
import type {
  ReactionSummaryMap,
  RepostSummaryMap,
} from '../../../src/lib/thread/thread-reactions';
import type { EventTreeListViewRow } from '../../../src/lib/components/events/event-tree-list-helpers';
import {
  eventTreeListRowData,
  eventTreeListRowRenderPlan,
} from '../../../src/lib/components/events/event-tree-list-row-plan';

const pubkey = 'a'.repeat(64);
const otherPubkey = 'b'.repeat(64);
const hiddenContinuation = { visible: false } as const;
const visibleContinuation = {
  visible: true,
  canOpenThread: false,
  depth: 0,
  hiddenCount: 1,
  targetId: 'event1',
  buttonText: 'Continue thread (1)',
  unavailableText: '1 hidden thread item(s) unavailable.',
} as const;

describe('event tree list row plan', () => {
  it('projects profile, action, reaction, and repost state by real event identity', () => {
    const profile = profileSummary(pubkey, 'Ada');
    const reactions: ReactionSummaryMap = {
      event1: [{ content: '+', count: 2, actors: [pubkey, otherPubkey] }],
      other: [{ content: '-', count: 1, actors: [otherPubkey] }],
    };
    const reposts: RepostSummaryMap = {
      event1: { count: 1, actors: [otherPubkey] },
    };
    const actionStates = new Map<string, EventActionState>([
      ['event1', { liked: true, reposted: false }],
    ]);

    expect(
      eventTreeListRowData({
        node: node('event1', pubkey),
        profiles: { [pubkey]: profile },
        reactions,
        reposts,
        actionStates,
      }),
    ).toEqual({
      profile,
      liked: true,
      reposted: false,
      reactions: reactions.event1,
      reposts: reposts.event1,
    });
  });

  it('falls back to explicit false action state without inventing summaries', () => {
    expect(
      eventTreeListRowData({
        node: node('missing', pubkey),
        profiles: { [otherPubkey]: profileSummary(otherPubkey, 'Other') },
        reactions: {},
        reposts: {},
        actionStates: new Map(),
      }),
    ).toEqual({
      profile: undefined,
      liked: false,
      reposted: false,
      reactions: undefined,
      reposts: undefined,
    });
  });

  it('plans retained row render branches without changing row state', () => {
    expect(
      eventTreeListRowRenderPlan({
        row: { kind: 'leading', row: { key: 'top' } },
        continuation: hiddenContinuation,
      }),
    ).toMatchObject({ kind: 'leading' });
    expect(
      eventTreeListRowRenderPlan({
        row: { kind: 'terminal' },
        continuation: hiddenContinuation,
      }),
    ).toEqual({ kind: 'terminal' });
    expect(
      eventTreeListRowRenderPlan({
        row: { kind: 'loadingOlder' },
        continuation: hiddenContinuation,
      }),
    ).toEqual({ kind: 'loadingOlder' });
    expect(
      eventTreeListRowRenderPlan({
        row: { kind: 'empty', text: 'No events.' },
        continuation: hiddenContinuation,
      }),
    ).toMatchObject({ kind: 'empty', row: { text: 'No events.' } });
    expect(
      eventTreeListRowRenderPlan({
        row: eventRow('event1'),
        continuation: hiddenContinuation,
      }),
    ).toMatchObject({ kind: 'event' });
    expect(
      eventTreeListRowRenderPlan({
        row: eventRow('event1'),
        continuation: visibleContinuation,
      }),
    ).toEqual({ kind: 'continuation', continuation: visibleContinuation });
    expect(
      eventTreeListRowRenderPlan({
        row: eventFragmentRow('event1'),
        continuation: hiddenContinuation,
      }),
    ).toMatchObject({ kind: 'eventFragment' });
  });

  it('preserves the retained no-render fallback for malformed event rows', () => {
    expect(
      eventTreeListRowRenderPlan({
        row: {
          kind: 'event',
          node: { depth: 0 },
          visualIndex: 0,
        } as unknown as EventTreeListViewRow,
        continuation: hiddenContinuation,
      }),
    ).toEqual({ kind: 'hidden' });
  });
});

function node(id: string, author: string): FlatEventTreeItem {
  return {
    event: {
      id,
      pubkey: author,
      created_at: 1,
      kind: 1,
      tags: [],
      content: '',
      sig: 'c'.repeat(128),
    },
    relays: ['wss://relay.example'],
    children: [],
    depth: 0,
  } as FlatEventTreeItem;
}

function eventRow(id: string): EventTreeListViewRow {
  return { kind: 'event', node: node(id, pubkey), visualIndex: 0 };
}

function eventFragmentRow(id: string): EventTreeListViewRow {
  return {
    kind: 'eventFragment',
    node: node(id, pubkey),
    visualIndex: 0,
    fragment: {
      kind: 'event-text-segment',
      rowKey: `${id}:fragment`,
      segmentIndex: 0,
      text: 'chunk',
      startsAt: 0,
      endsAt: 5,
    } as FeedVisualFragment,
  };
}

function profileSummary(author: string, displayName: string): ProfileSummary {
  return {
    pubkey: author,
    displayName,
    name: displayName.toLowerCase(),
    nip05: null,
    avatarUrl: null,
    updatedAt: 1,
  };
}
