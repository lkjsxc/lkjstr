import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const content = () =>
  readFileSync('src/lib/components/events/EventContent.svelte', 'utf8');
const target = () =>
  readFileSync('src/lib/components/events/EventRepostTarget.svelte', 'utf8');
const core = () =>
  readFileSync('src/lib/components/events/EventContentCore.svelte', 'utf8');

describe('repost target rendering', () => {
  it('routes nested repost targets through the shared content pipeline', () => {
    expect(content()).toContain('EventRepostTarget');
    expect(target()).toContain('EventContentCore');
    expect(target()).toContain('data-event-display-context="repost-target"');
  });

  it('keeps content features shared for normal events and repost targets', () => {
    const source = core();

    expect(source).toContain('ContentTokens');
    expect(source).toContain('MediaAttachment');
    expect(source).toContain('EventReferences');
    expect(source).toContain('subscribeHideSensitiveEvents');
    expect(source).toContain('EmojifiedText');
  });

  it('does not keep the old ad hoc nested repost body', () => {
    const source = content();

    expect(source).not.toContain('data-kind="nested-repost"');
    expect(source).not.toContain('<ContentTokens');
    expect(source).not.toContain('<EventMeta');
  });
});
