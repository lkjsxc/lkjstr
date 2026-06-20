import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const inlinePanel = readFileSync(
  'src/lib/components/events/EventActionInlinePanel.svelte',
  'utf8',
);

describe('event action inline panel presenter', () => {
  it('owns retained reply form chrome and submit wiring', () => {
    expect(inlinePanel).toContain("props.panel.kind === 'reply'");
    expect(inlinePanel).toContain('class="event-inline-action"');
    expect(inlinePanel).toContain(
      'submitEventActionReply(event, props.submitReply)',
    );
    expect(inlinePanel).toContain('aria-label={props.panel.replyLabel}');
    expect(inlinePanel).toContain('oninput={updateReply}');
    expect(inlinePanel).toContain('submitEventActionReplyShortcut');
    expect(inlinePanel).toContain('class="icon-button icon-button--submit"');
    expect(inlinePanel).toContain('disabled={props.panel.submitDisabled}');
    expect(inlinePanel).toContain(
      '<span class="sr-only">{props.panel.publishLabel}</span>',
    );
  });

  it('keeps retained zap mode on the shared zap panel presenter', () => {
    expect(inlinePanel).toContain("props.panel.kind === 'zap'");
    expect(inlinePanel).toContain('<EventZapPanel');
    expect(inlinePanel).toContain('event={props.event}');
    expect(inlinePanel).toContain('profile={props.profile}');
    expect(inlinePanel).toContain('relaySets={props.relaySets}');
  });
});
