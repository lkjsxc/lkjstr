import { contentAttachments } from '$lib/events/content-media';
import { eventReferenceLabel } from '$lib/events/reference-label';
import type { ResolvedReference } from '$lib/events/reference-resolver';
import type { ProfileSummary } from '$lib/identity/identity';
import type { NostrEvent } from '$lib/protocol';
import { hasOpenThreadAction } from './action-availability';

export type EventReferenceCardPlan = {
  readonly canOpenThread: boolean;
  readonly event: NostrEvent | undefined;
  readonly label: string;
  readonly mediaCount: number;
  readonly preview: string;
  readonly profile: ProfileSummary | undefined;
  readonly relays: readonly string[];
};

type EventReferenceCardOpenEvent = {
  stopPropagation(): void;
};

export function planEventReferenceCard(
  reference: ResolvedReference,
  profiles: Record<string, ProfileSummary>,
  openThread?: (eventId: string) => void,
): EventReferenceCardPlan {
  const event = reference.event?.event;
  return {
    canOpenThread: hasOpenThreadAction(openThread),
    event,
    label: eventReferenceLabel(reference),
    mediaCount: event ? contentAttachments(event).length : 0,
    preview: event?.content.trim().replace(/\s+/gu, ' ') ?? '',
    profile: event ? profiles[event.pubkey] : undefined,
    relays: reference.event?.relays ?? [],
  };
}

export function eventReferenceCardKeyOpensThread(key: string): boolean {
  return key === 'Enter';
}

export function openEventReferenceCardThread(
  plan: Pick<EventReferenceCardPlan, 'canOpenThread'>,
  eventId: string,
  openThread?: (eventId: string) => void,
  domEvent?: EventReferenceCardOpenEvent,
): boolean {
  domEvent?.stopPropagation();
  if (!plan.canOpenThread || !hasOpenThreadAction(openThread)) return false;
  openThread(eventId);
  return true;
}
