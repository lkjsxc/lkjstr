import type { ActionSummary } from '$lib/events/action-summary';
import { actionSummary } from '$lib/events/action-summary';
import type { ContentAttachment } from '$lib/events/content-media';
import { contentAttachments } from '$lib/events/content-media';
import {
  contentWarningReason,
  eventReferences,
  verifiedNestedRepost,
  type EventReference,
  type NostrEvent,
} from '$lib/protocol';

export type EventContentPlan = {
  readonly nested: NostrEvent | undefined;
  readonly references: readonly EventReference[];
};

export type EventContentCorePlan = {
  readonly attachments: readonly ContentAttachment[];
  readonly referenceIds: ReadonlySet<string>;
  readonly summary: ActionSummary | undefined;
  readonly sensitivity: EventContentSensitivity;
};

export type EventContentSensitivity = {
  readonly gated: boolean;
  readonly label: string;
  readonly reason: string;
  readonly revealLabel: string;
  readonly showBadge: boolean;
};

export function planEventContent(
  event: NostrEvent,
  options: {
    readonly depth?: number;
    readonly renderNestedRepost?: boolean;
  } = {},
): EventContentPlan {
  const nested =
    options.renderNestedRepost === false
      ? undefined
      : verifiedNestedRepost(event);
  return {
    nested,
    references: eventContentReferences(event, {
      depth: options.depth,
      excludedIds: nested ? [nested.id] : [],
    }),
  };
}

export function planEventContentCore(
  event: NostrEvent,
  references: readonly EventReference[],
  options: {
    readonly hideSensitive: boolean;
    readonly revealed: boolean;
    readonly showSummary?: boolean;
  },
): EventContentCorePlan {
  return {
    attachments: contentAttachments(event).filter(
      (item) => item.type !== 'link',
    ),
    referenceIds: eventReferenceIds(references),
    summary: options.showSummary === false ? undefined : actionSummary(event),
    sensitivity: eventContentSensitivity(event, options),
  };
}

export function eventContentReferences(
  event: NostrEvent,
  options: {
    readonly depth?: number;
    readonly excludedIds?: readonly string[];
  } = {},
): readonly EventReference[] {
  if ((options.depth ?? 0) >= 2) return [];
  const hidden = new Set([event.id, ...(options.excludedIds ?? [])]);
  return eventReferences(event).filter(
    (reference) => !hidden.has(reference.id),
  );
}

export function eventRepostTargetLabel(): 'Reposted event' {
  return 'Reposted event';
}

type EventContentRevealEvent = {
  stopPropagation(): void;
};

export function revealEventContent(
  event: EventContentRevealEvent,
  recordReveal: () => void,
): true {
  event.stopPropagation();
  recordReveal();
  return true;
}

function eventReferenceIds(
  references: readonly EventReference[],
): ReadonlySet<string> {
  return new Set(references.map((item) => item.id));
}

function eventContentSensitivity(
  event: NostrEvent,
  options: { readonly hideSensitive: boolean; readonly revealed: boolean },
): EventContentSensitivity {
  const reason = contentWarningReason(event);
  const sensitive = reason !== null;
  return {
    gated: sensitive && options.hideSensitive && !options.revealed,
    label: 'Sensitive content',
    reason: reason ?? '',
    revealLabel: 'Reveal',
    showBadge: sensitive && !options.hideSensitive,
  };
}
