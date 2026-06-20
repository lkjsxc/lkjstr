import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const eventMentionChip = readFileSync(
  'src/lib/components/events/EventMentionChip.svelte',
  'utf8',
);

describe('event mention chip presenter wiring', () => {
  it('routes retained mention lookup through resolver and hydration plans', () => {
    expect(eventMentionChip).toContain('planEventMentionChip({');
    expect(eventMentionChip).toContain('references: [plan.reference]');
    expect(eventMentionChip).toContain('relays: plan.relays');
    expect(eventMentionChip).toContain('key: plan.resolverKey');
    expect(eventMentionChip).toContain('eventMentionHydrationPlan(event');
    expect(eventMentionChip).toContain("owner: 'event-mention'");
    expect(eventMentionChip).toContain('eventMentionLoadedPlan(event');
    expect(eventMentionChip).toContain('excerpt = loaded.excerpt');
    expect(eventMentionChip).toContain('profile = loaded.profile');
  });

  it('keeps retained openability and loaded-state chrome on planned data', () => {
    expect(eventMentionChip).toContain('rawText: props.rawText');
    expect(eventMentionChip).toContain('{#if plan.canOpenThread}');
    expect(eventMentionChip).toContain('onclick={open}');
    expect(eventMentionChip).toContain('openEventMentionThread(');
    expect(eventMentionChip).toContain('title={plan.title}');
    expect(eventMentionChip).toContain('{#snippet chipBody()}');
    expect(eventMentionChip).toContain('<span>{plan.label}</span>');
    expect(eventMentionChip).toContain('<IdentityChip');
    expect(eventMentionChip).toContain(
      '{#if excerpt}<small>{excerpt}</small>{/if}',
    );
    expect(eventMentionChip.match(/\{@render chipBody\(\)\}/g)).toHaveLength(2);
  });
});
