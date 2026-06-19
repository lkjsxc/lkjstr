import type { ResolvedReference } from '$lib/events/reference-resolver';

export type EventReferenceListPlan = {
  readonly canToggle: boolean;
  readonly toggleLabel: string;
  readonly visible: readonly ResolvedReference[];
};

type EventReferenceListToggleEvent = {
  stopPropagation(): void;
};

const collapsedReferenceLimit = 3;

export function planEventReferenceList(
  references: readonly ResolvedReference[],
  expanded: boolean,
): EventReferenceListPlan {
  return {
    canToggle: references.length > collapsedReferenceLimit,
    toggleLabel: expanded
      ? 'Hide references'
      : `Show all references (${references.length})`,
    visible: expanded
      ? references
      : references.slice(0, collapsedReferenceLimit),
  };
}

export function toggleEventReferenceListExpanded(expanded: boolean): boolean {
  return !expanded;
}

export function toggleEventReferenceList(
  event: EventReferenceListToggleEvent,
  expanded: boolean,
): boolean {
  event.stopPropagation();
  return toggleEventReferenceListExpanded(expanded);
}
