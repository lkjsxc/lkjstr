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
  readonly mediaLabel: string;
  readonly mediaCount: number;
  readonly preview: string;
  readonly profile: ProfileSummary | undefined;
  readonly relays: readonly string[];
  readonly unavailableText: 'Event unavailable.';
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
  const mediaCount = event ? contentAttachments(event).length : 0;
  const canOpenThread = hasOpenThreadAction(openThread);
  return {
    canOpenThread,
    event,
    label: eventReferenceLabel(reference),
    mediaLabel: mediaCount > 0 ? `${mediaCount} media attachment(s)` : '',
    mediaCount,
    preview: event?.content.trim().replace(/\s+/gu, ' ') ?? '',
    profile: event ? profiles[event.pubkey] : undefined,
    relays: reference.event?.relays ?? [],
    unavailableText: 'Event unavailable.',
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
