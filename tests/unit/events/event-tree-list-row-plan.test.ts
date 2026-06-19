import { describe, expect, it } from 'vitest';
import type { EventActionState } from '../../../src/lib/events/action-state';
import type { FlatEventTreeItem } from '../../../src/lib/events/tree';
import type { ProfileSummary } from '../../../src/lib/identity/identity';
import type {
  ReactionSummaryMap,
  RepostSummaryMap,
} from '../../../src/lib/thread/thread-reactions';
import { eventTreeListRowData } from '../../../src/lib/components/events/event-tree-list-row-plan';

const pubkey = 'a'.repeat(64);
const otherPubkey = 'b'.repeat(64);

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
