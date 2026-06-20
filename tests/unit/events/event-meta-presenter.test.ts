import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const eventMeta = readFileSync(
  'src/lib/components/events/EventMeta.svelte',
  'utf8',
);

describe('event meta presenter wiring', () => {
  it('keeps retained author identity chrome shared across openable states', () => {
    expect(eventMeta).toContain('{#snippet identityBody()}');
    expect(eventMeta).toContain('{#if canOpenProfile}');
    expect(eventMeta).toContain('onclick={openProfile}');
    expect(eventMeta).toContain('<span class="identity-button">');
    expect(eventMeta).toContain('pubkey={display.pubkey}');
    expect(eventMeta).toContain('EmojifiedText');
    expect(eventMeta).toContain('{#if display.subtitle}');
    expect(eventMeta.match(/\{@render identityBody\(\)\}/g)).toHaveLength(2);
  });

  it('derives retained overflow labels and author context from helpers', () => {
    expect(eventMeta).toContain(
      'const overflowLabels = eventMetaOverflowLabels();',
    );
    expect(eventMeta).toContain(
      'eventMetaHasAuthorContext(props.openAuthorContext)',
    );
    expect(eventMeta).toContain('aria-label={overflowLabels.menu}');
    expect(eventMeta).toContain('onclick={stopEventMetaOverflowPropagation}');
    expect(eventMeta).toContain('{overflowLabels.nearbyAuthor}');
    expect(eventMeta).toContain('openEventMetaAuthorContext(');
  });

  it('delegates retained event-id copy status lifecycle to helpers', () => {
    expect(eventMeta).toContain('createEventMetaCopyStatusResetter(');
    expect(eventMeta).toContain('copyStatusResetter.clear();');
    expect(eventMeta).toContain('const status = await copyEventMetaEventId(');
    expect(eventMeta).toContain('navigator.clipboard');
    expect(eventMeta).toContain('copyStatusResetter.show(status);');
    expect(eventMeta).toContain('role="status"');
    expect(eventMeta).toContain('eventMetaCopyStatusLabel(copyStatus)');
  });
});
