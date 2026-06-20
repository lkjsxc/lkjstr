import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const reactionSummary = readFileSync(
  'src/lib/components/events/ReactionSummary.svelte',
  'utf8',
);
const actorRow = readFileSync(
  'src/lib/components/events/ReactionSummaryActorRow.svelte',
  'utf8',
);

describe('reaction summary presenter wiring', () => {
  it('derives retained reaction and repost summary rows from the helper plan', () => {
    expect(reactionSummary).toContain('planReactionSummary({');
    expect(reactionSummary).toContain('toggleReactionSummary(expanded, id)');
    expect(reactionSummary).toContain('openReactionSummaryActor(');
    expect(reactionSummary).toContain('aria-label={plan.reactionsLabel}');
    expect(reactionSummary).toContain(
      '{#each plan.reactions as reaction (reaction.key)}',
    );
    expect(reactionSummary).toContain(
      'class:reaction-summary__own={reaction.own}',
    );
    expect(reactionSummary).toContain('aria-label={reaction.toggleLabel}');
    expect(reactionSummary).toContain('aria-expanded={reaction.expanded}');
    expect(reactionSummary).toContain('<strong>{reaction.countText}</strong>');
  });

  it('keeps retained repost and actor rows on shared presenter paths', () => {
    expect(reactionSummary).toContain('{#if plan.reposts.visible}');
    expect(reactionSummary).toContain('aria-label={plan.reposts.toggleLabel}');
    expect(reactionSummary).toContain(
      '<strong>{plan.reposts.countText}</strong>',
    );
    expect(reactionSummary).toContain(
      '{@render actorRows(plan.reposts.actors)}',
    );
    expect(reactionSummary).toContain(
      '<ReactionSummaryActorRow {actor} {openActor} />',
    );
  });

  it('renders retained actor rows as openable buttons only when planned openable', () => {
    expect(actorRow).toContain('{#if props.actor.canOpen}');
    expect(actorRow).toContain('<button type="button" onclick={openRowActor}>');
    expect(actorRow).toContain('<span class="reaction-summary__actor">');
    expect(actorRow).toContain('{#snippet actorBody()}');
    expect(actorRow).toContain('pubkey={props.actor.pubkey}');
    expect(actorRow).toContain('src={props.actor.avatarUrl}');
    expect(actorRow).toContain('EmojifiedText text={props.actor.name}');
    expect(actorRow.match(/\{@render actorBody\(\)\}/g)).toHaveLength(2);
  });
});
