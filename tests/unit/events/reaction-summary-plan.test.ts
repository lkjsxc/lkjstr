import { describe, expect, it } from 'vitest';
import type { ProfileSummary } from '../../../src/lib/identity/identity';
import type { ReactionGroup } from '../../../src/lib/thread/thread-reactions';
import {
  openReactionSummaryActor,
  planReactionSummary,
  toggleReactionSummary,
} from '../../../src/lib/components/events/reaction-summary-plan';

describe('reaction summary plan', () => {
  it('plans reaction keys, labels, icons, own state, and actor display data', () => {
    const actor = 'a'.repeat(64);
    const plan = planReactionSummary({
      reactions: [
        reaction('+', [actor], {
          shortcode: 'party',
          url: 'https://emoji.example/party.png',
          address: '30030:'.concat('b'.repeat(64), ':party'),
        }),
        reaction('-', ['c'.repeat(64)]),
        reaction(':party:', ['d'.repeat(64)]),
      ],
      profiles: { [actor]: profile(actor) },
      activeAccountPubkey: actor,
      expanded: 'reaction-+:https://emoji.example/party.png:30030:'.concat(
        'b'.repeat(64),
        ':party',
      ),
    });

    expect(plan.reactionsLabel).toBe('Reactions');
    expect(plan.reactions.map((item) => item.icon)).toEqual([
      'like',
      'dislike',
      'custom',
    ]);
    expect(plan.reactions[0]).toMatchObject({
      label: 'like',
      own: true,
      expanded: true,
      count: 1,
    });
    expect(plan.reactions[0]?.actors[0]).toMatchObject({
      pubkey: actor,
      name: 'Display',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(plan.reactions[1]?.label).toBe('dislike');
    expect(plan.reactions[2]?.label).toBe(':party:');
  });

  it('plans repost visibility and expansion without fake actors', () => {
    const actor = 'e'.repeat(64);
    expect(
      planReactionSummary({ reposts: { count: 0, actors: [] }, expanded: '' })
        .reposts,
    ).toMatchObject({ visible: false, count: 0, actors: [] });

    expect(
      planReactionSummary({
        reposts: { count: 1, actors: [actor] },
        expanded: 'reposts',
      }).reposts,
    ).toMatchObject({
      visible: true,
      expanded: true,
      id: 'reposts',
      label: 'repost',
      count: 1,
      actors: [{ pubkey: actor }],
    });
  });

  it('toggles a single expanded summary id', () => {
    expect(toggleReactionSummary('', 'reposts')).toBe('reposts');
    expect(toggleReactionSummary('reposts', 'reposts')).toBe('');
    expect(toggleReactionSummary('reposts', 'reaction-+::')).toBe(
      'reaction-+::',
    );
  });

  it('opens reaction summary actors only through real profile callbacks', () => {
    const opened: string[] = [];
    expect(
      openReactionSummaryActor(
        (pubkey) => {
          opened.push(pubkey);
        },
        { pubkey: 'actor' },
      ),
    ).toBe(true);
    expect(openReactionSummaryActor(undefined, { pubkey: 'actor-2' })).toBe(
      false,
    );

    expect(opened).toEqual(['actor']);
  });
});

function reaction(
  content: string,
  actors: readonly string[],
  emoji?: ReactionGroup['emoji'],
): ReactionGroup {
  return { content, actors, emoji, count: actors.length };
}

function profile(pubkey: string): ProfileSummary {
  return {
    pubkey,
    displayName: 'Display',
    name: null,
    nip05: null,
    avatarUrl: 'https://example.com/avatar.png',
    updatedAt: 1,
    customEmojis: [{ shortcode: 'party', url: 'https://emoji.example/p.png' }],
  };
}
