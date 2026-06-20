import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const profileMentionChip = readFileSync(
  'src/lib/components/events/ProfileMentionChip.svelte',
  'utf8',
);

describe('profile mention chip presenter wiring', () => {
  it('keeps retained profile mention chrome on planned data', () => {
    expect(profileMentionChip).toContain('planProfileMentionChip({');
    expect(profileMentionChip).toContain('text: props.text');
    expect(profileMentionChip).toContain('rawText: props.rawText');
    expect(profileMentionChip).toContain('{#if plan.canOpenProfile}');
    expect(profileMentionChip).toContain('title={plan.title}');
    expect(profileMentionChip).toContain('onclick={open}');
    expect(profileMentionChip).toContain('stopAndOpenEventProfile(');
    expect(profileMentionChip).toContain('{#snippet chipBody()}');
    expect(profileMentionChip).toContain(
      '<EmojifiedText text={plan.text} emojis={plan.emojis} />',
    );
    expect(profileMentionChip.match(/\{@render chipBody\(\)\}/g)).toHaveLength(
      2,
    );
  });
});
