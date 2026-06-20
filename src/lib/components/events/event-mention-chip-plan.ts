import type { ProfileSummary } from '$lib/identity/identity';
import type { EventReference, NostrEvent } from '$lib/protocol';
import { hasOpenThreadAction } from './action-availability';

export type EventMentionChipPlan = {
  readonly canOpenThread: boolean;
  readonly label: string;
  readonly reference: EventReference;
  readonly relays: readonly string[];
  readonly resolverKey: string;
  readonly title: string;
};

export type EventMentionLoadedPlan = {
  readonly excerpt: string;
  readonly profile: ProfileSummary | undefined;
};

type EventMentionOpenEvent = {
  stopPropagation(): void;
};

export function planEventMentionChip(input: {
  readonly eventId: string;
  readonly rawText: string;
  readonly relays?: readonly string[];
  readonly fallbackRelays?: readonly string[];
  readonly openThread?: (eventId: string) => void;
}): EventMentionChipPlan {
  return {
    canOpenThread: hasOpenThreadAction(input.openThread),
    label: `event:${input.eventId.slice(0, 8)}`,
    reference: {
      kind: 'nostr-event',
      id: input.eventId,
      relays: input.relays ?? [],
    },
    relays: [
      ...new Set([...(input.relays ?? []), ...(input.fallbackRelays ?? [])]),
    ],
    resolverKey: `mention:${input.eventId.slice(0, 12)}`,
    title: input.rawText,
  };
}

export function openEventMentionThread(
  event: EventMentionOpenEvent,
  openThread: ((eventId: string) => void) | undefined,
  eventId: string,
): void {
  event.stopPropagation();
  if (!hasOpenThreadAction(openThread)) return;
  openThread(eventId);
}

export function eventMentionExcerpt(
  event: Pick<NostrEvent, 'content'>,
): string {
  return event.content.trim().replace(/\s+/gu, ' ').slice(0, 96);
}

export function eventMentionHydrationPlan(
  event: Pick<NostrEvent, 'pubkey'>,
  profiles: Record<string, ProfileSummary> = {},
): {
  readonly profile: ProfileSummary | undefined;
  readonly pubkeys: string[];
} {
  const profile = profiles[event.pubkey];
  return { profile, pubkeys: profile ? [] : [event.pubkey] };
}

export function eventMentionLoadedPlan(
  event: Pick<NostrEvent, 'content' | 'pubkey'>,
  profiles: Record<string, ProfileSummary> = {},
  hydrated: Record<string, ProfileSummary> = {},
): EventMentionLoadedPlan {
  const hydration = eventMentionHydrationPlan(event, profiles);
  return {
    excerpt: eventMentionExcerpt(event),
    profile: hydration.profile ?? hydrated[event.pubkey],
  };
}
