import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const eventReferences = readFileSync(
  'src/lib/components/events/EventReferences.svelte',
  'utf8',
);
const referenceList = readFileSync(
  'src/lib/components/events/EventReferenceList.svelte',
  'utf8',
);
const referenceCard = readFileSync(
  'src/lib/components/events/EventReferenceCard.svelte',
  'utf8',
);

describe('event reference presenter wiring', () => {
  it('routes retained reference loading through the hydration helper', () => {
    expect(eventReferences).toContain('eventReferencesRenderPlan,');
    expect(eventReferences).toContain('let render = $derived(');
    expect(eventReferences).toContain(
      'referenceCount: props.references.length',
    );
    expect(eventReferences).toContain('void loadEventReferences({');
    expect(eventReferences).toContain('resolveReferences,');
    expect(eventReferences).toContain('hydrateProfiles,');
    expect(eventReferences).toContain('isAlive: () => alive');
    expect(eventReferences).toContain('resolved = plan.resolved');
    expect(eventReferences).toContain('profiles = plan.profiles');
    expect(eventReferences).toContain('loaded = plan.loaded');
    expect(eventReferences).toContain('alive = false;');
    expect(eventReferences).toContain('{#if render.showLoading}');
    expect(eventReferences).toContain('{render.loadingStatus}');
    expect(eventReferences).toContain('{#if render.showReferences}');
    expect(eventReferences).toContain('<EventReferenceList');
  });

  it('keeps retained reference list visibility and toggle on the list plan', () => {
    expect(referenceList).toContain(
      'planEventReferenceList(props.references, expanded)',
    );
    expect(referenceList).toContain('{#each plan.visible as reference');
    expect(referenceList).toContain('<EventReferenceCard');
    expect(referenceList).toContain('{#if plan.canToggle}');
    expect(referenceList).toContain(
      'toggleEventReferenceList(event, expanded)',
    );
    expect(referenceList).toContain('{plan.toggleLabel}');
  });

  it('keeps retained reference card openability on the card plan', () => {
    expect(referenceCard).toContain('planEventReferenceCard(');
    expect(referenceCard).toContain('openEventReferenceCardThread(');
    expect(referenceCard).toContain(
      'eventReferenceCardKeyOpensThread(event.key)',
    );
    expect(referenceCard).toContain('{#snippet cardBody()}');
    expect(referenceCard).toContain('{#if plan.canOpenThread}');
    expect(referenceCard).toContain('role="button"');
    expect(referenceCard).toContain('tabindex="0"');
    expect(referenceCard).toContain('data-kind={props.reference.kind}');
    expect(referenceCard).toContain(
      '<strong class="sr-only">{plan.label}</strong>',
    );
    expect(referenceCard.match(/<EventMeta/g)).toHaveLength(1);
    expect(referenceCard).toContain('event={plan.event}');
    expect(referenceCard).toContain('relays={plan.relays}');
    expect(referenceCard).toContain('profile={plan.profile}');
    expect(referenceCard).toContain('text={plan.preview}');
    expect(referenceCard).toContain('{#if plan.mediaLabel}');
    expect(referenceCard).toContain('{plan.unavailableText}');
    expect(referenceCard.match(/\{@render cardBody\(\)\}/g)).toHaveLength(2);
  });
});
