import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../../', import.meta.url);

describe('mention styling', () => {
  it('uses a dedicated underline class for profile and event mentions', () => {
    const profileChip = readFileSync(
      new URL('src/lib/components/events/ProfileMentionChip.svelte', root),
      'utf8',
    );
    const eventChip = readFileSync(
      new URL('src/lib/components/events/EventMentionChip.svelte', root),
      'utf8',
    );
    const mentionCss = readFileSync(
      new URL('src/styles/mentions.css', root),
      'utf8',
    );

    expect(profileChip).toContain('content-mention-token');
    expect(eventChip).toContain('content-mention-token event-mention-chip');
    expect(mentionCss).toContain('.content-mention-token');
    expect(mentionCss).toContain('text-decoration-line: underline');
  });
});
