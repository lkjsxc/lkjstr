import {
  copyEventIdToClipboard,
  type EventMetaClipboard,
  type EventMetaCopyStatus,
} from './event-meta-copy-status';

export type EventMetaAuthorContextAction =
  | ((eventId: string, pubkey: string) => void)
  | undefined;

type EventMetaOverflowEvent = {
  stopPropagation(): void;
};

export type EventMetaOverflowLabels = {
  readonly copyEventId: 'Copy event ID';
  readonly menu: 'Event menu';
  readonly nearbyAuthor: 'Nearby posts by this author';
};

export function eventMetaOverflowLabels(): EventMetaOverflowLabels {
  return {
    copyEventId: 'Copy event ID',
    menu: 'Event menu',
    nearbyAuthor: 'Nearby posts by this author',
  };
}

export function eventMetaHasAuthorContext(
  action: EventMetaAuthorContextAction,
): action is (eventId: string, pubkey: string) => void {
  return typeof action === 'function';
}

export function stopEventMetaOverflowPropagation(
  event: EventMetaOverflowEvent,
): void {
  event.stopPropagation();
}

export function openEventMetaAuthorContext(
  event: EventMetaOverflowEvent,
  action: EventMetaAuthorContextAction,
  eventId: string,
  pubkey: string,
): boolean {
  stopEventMetaOverflowPropagation(event);
  if (!eventMetaHasAuthorContext(action)) return false;
  action(eventId, pubkey);
  return true;
}

export async function copyEventMetaEventId(
  event: EventMetaOverflowEvent,
  eventId: string,
  clipboard: EventMetaClipboard | undefined,
): Promise<EventMetaCopyStatus> {
  stopEventMetaOverflowPropagation(event);
  return copyEventIdToClipboard(eventId, clipboard);
}
