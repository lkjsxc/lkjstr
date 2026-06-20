import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const eventContent = readFileSync(
  'src/lib/components/events/EventContent.svelte',
  'utf8',
);
const contentCore = readFileSync(
  'src/lib/components/events/EventContentCore.svelte',
  'utf8',
);
const contentTokens = readFileSync(
  'src/lib/components/events/ContentTokens.svelte',
  'utf8',
);
const contentTokenLink = readFileSync(
  'src/lib/components/events/ContentTokenLink.svelte',
  'utf8',
);
const contentWarning = readFileSync(
  'src/lib/components/events/EventContentWarning.svelte',
  'utf8',
);
const repostTarget = readFileSync(
  'src/lib/components/events/EventRepostTarget.svelte',
  'utf8',
);

describe('event content presenter wiring', () => {
  it('routes retained event content through the shared content plan', () => {
    expect(eventContent).toContain('planEventContent(props.event, {');
    expect(eventContent).toContain('references={plan.references}');
    expect(eventContent).toContain('{#if plan.nested}');
    expect(eventContent).toContain('event={plan.nested}');
    expect(eventContent).toContain('<EventRepostTarget');
  });

  it('delegates core content, media, references, and sensitivity to helpers', () => {
    expect(contentCore).toContain('planEventContentCore(props.event');
    expect(contentCore).toContain('subscribeHideSensitiveEvents(');
    expect(contentCore).toContain('isSensitiveEventRevealed(props.event.id)');
    expect(contentCore).toContain('revealEventContent(event, () =>');
    expect(contentCore).toContain('revealSensitiveEvent(props.event.id)');
    expect(contentCore).toContain('sensitivity={plan.sensitivity}');
    expect(contentCore).toContain('hiddenEventIds={plan.referenceIds}');
    expect(contentCore).toContain(
      '{#each plan.attachments as attachment (attachment.url)}',
    );
    expect(contentCore).toContain('<EventReferences');
  });

  it('keeps retained token links and hidden event mentions on token plans', () => {
    expect(contentTokens).toContain('contentTokens(props.event)');
    expect(contentTokens).toContain('contentTokenRenderKey(token, index)');
    expect(contentTokens).toContain('<ContentTokenLink');
    expect(contentTokens).toContain('contentTokenProfileLabel(');
    expect(contentTokens).toContain('contentTokenEventVisible(');
    expect(contentTokenLink).toContain('contentTokenUrlLinkPlan(props.url)');
    expect(contentTokenLink).toContain(
      'onclick={stopContentTokenLinkPropagation}',
    );
  });

  it('keeps repost target and sensitive warning chrome on planned data', () => {
    expect(contentWarning).toContain(
      '<strong>{props.sensitivity.label}</strong>',
    );
    expect(contentWarning).toContain('{props.sensitivity.reason}');
    expect(contentWarning).toContain('{props.sensitivity.revealLabel}');
    expect(contentWarning).toContain('onclick={props.onReveal}');
    expect(repostTarget).toContain('const label = eventRepostTargetLabel();');
    expect(repostTarget).toContain('<strong class="sr-only">{label}</strong>');
    expect(repostTarget).toContain(
      'data-event-display-context="repost-target"',
    );
    expect(repostTarget).toContain('<EventContentCore');
  });
});
