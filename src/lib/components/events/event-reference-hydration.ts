import type { ResolvedReference } from '$lib/events/reference-resolver';
import type { ProfileSummary } from '$lib/identity/identity';
import type { EventReference } from '$lib/protocol';

export function eventReferenceResolutionKey(
  references: readonly EventReference[],
): string {
  return `refs:${references.length}:${references[0]?.id.slice(0, 12)}`;
}

export function eventReferencesLoadingStatus(): 'Loading referenced events...' {
  return 'Loading referenced events...';
}

export type EventReferencesLoadedPlan = {
  readonly loaded: true;
  readonly profiles: Record<string, ProfileSummary>;
  readonly resolved: readonly ResolvedReference[];
};

export type EventReferencesRenderPlan = {
  readonly loadingStatus: ReturnType<typeof eventReferencesLoadingStatus>;
  readonly showLoading: boolean;
  readonly showReferences: boolean;
};

export type EventReferencesLoadCallbacks = {
  readonly apply: (plan: EventReferencesLoadedPlan) => void;
  readonly hydrateProfiles: (input: {
    readonly owner: string;
    readonly pubkeys: readonly string[];
    readonly relays: readonly string[];
  }) => Promise<Record<string, ProfileSummary>>;
  readonly isAlive: () => boolean;
  readonly resolveReferences: (input: {
    readonly key: string;
    readonly references: readonly EventReference[];
    readonly relays: readonly string[];
  }) => Promise<readonly ResolvedReference[]>;
};

export type EventReferencesLoadInput = {
  readonly callbacks: EventReferencesLoadCallbacks;
  readonly profiles?: Record<string, ProfileSummary>;
  readonly references: readonly EventReference[];
  readonly relays: readonly string[];
};

export function eventReferencesShouldShowLoading(
  loaded: boolean,
  referenceCount: number,
): boolean {
  return !loaded && referenceCount > 0;
}

export function eventReferencesRenderPlan(input: {
  readonly loaded: boolean;
  readonly referenceCount: number;
}): EventReferencesRenderPlan {
  return {
    loadingStatus: eventReferencesLoadingStatus(),
    showLoading: eventReferencesShouldShowLoading(
      input.loaded,
      input.referenceCount,
    ),
    showReferences: input.loaded,
  };
}

export function loadedEventReferencesPlan(
  resolved: readonly ResolvedReference[],
  profiles: Record<string, ProfileSummary> | undefined,
  hydrated: Record<string, ProfileSummary>,
): EventReferencesLoadedPlan {
  return {
    loaded: true,
    profiles: mergeReferenceProfiles(profiles, hydrated),
    resolved,
  };
}

export function missingReferenceAuthors(
  references: readonly ResolvedReference[],
  profiles: Record<string, ProfileSummary> = {},
): string[] {
  const authors = new Set<string>();
  for (const reference of references) {
    const pubkey = reference.event?.event.pubkey;
    if (pubkey && !profiles[pubkey]) authors.add(pubkey);
  }
  return [...authors];
}

export function mergeReferenceProfiles(
  profiles: Record<string, ProfileSummary> = {},
  hydrated: Record<string, ProfileSummary>,
): Record<string, ProfileSummary> {
  return { ...profiles, ...hydrated };
}

export async function loadEventReferences({
  callbacks,
  profiles,
  references,
  relays,
}: EventReferencesLoadInput): Promise<void> {
  const resolved = await callbacks.resolveReferences({
    references,
    relays,
    key: eventReferenceResolutionKey(references),
  });
  if (!callbacks.isAlive()) return;
  const hydrated = await callbacks.hydrateProfiles({
    pubkeys: missingReferenceAuthors(resolved, profiles),
    relays,
    owner: 'event-references',
  });
  if (!callbacks.isAlive()) return;
  callbacks.apply(loadedEventReferencesPlan(resolved, profiles, hydrated));
}
