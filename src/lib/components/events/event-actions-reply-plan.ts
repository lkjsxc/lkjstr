export function canSubmitEventActionReply(
  reply: string,
  busy: boolean,
): boolean {
  return !busy && reply.trim().length > 0;
}

type EventActionReplySubmitEvent = {
  preventDefault(): void;
};

type EventActionReplyKeyEvent = {
  readonly ctrlKey: boolean;
  readonly key: string;
};

export function submitEventActionReply(
  event: EventActionReplySubmitEvent,
  submit: () => void,
): void {
  event.preventDefault();
  submit();
}

export function eventActionReplyKeySubmits(input: {
  readonly ctrlKey: boolean;
  readonly key: string;
}): boolean {
  return input.ctrlKey && input.key === 'Enter';
}

export function submitEventActionReplyShortcut(
  event: EventActionReplyKeyEvent,
  submit: () => void,
): boolean {
  if (!eventActionReplyKeySubmits(event)) return false;
  submit();
  return true;
}
