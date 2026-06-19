import type { ContentAttachment } from '$lib/events/content-media';

export type MediaAttachmentOpenPlan = {
  readonly url: string;
  readonly target: '_blank';
  readonly features: 'noopener,noreferrer';
};

export type MediaAttachmentLinkPlan = {
  readonly href: string;
  readonly target: '_blank';
  readonly rel: 'noopener noreferrer';
};

export type MediaAttachmentOpenAction = (
  url: string,
  target: '_blank',
  features: 'noopener,noreferrer',
) => unknown;

type MediaAttachmentEvent = {
  stopPropagation(): void;
};

export function planMediaAttachmentOpen(
  attachment: ContentAttachment,
): MediaAttachmentOpenPlan {
  return {
    url: attachment.url,
    target: '_blank',
    features: 'noopener,noreferrer',
  };
}

export function planMediaAttachmentLink(
  attachment: ContentAttachment,
): MediaAttachmentLinkPlan {
  return {
    href: attachment.url,
    target: '_blank',
    rel: 'noopener noreferrer',
  };
}

export function mediaAttachmentOpenButtonLabel(
  type: ContentAttachment['type'],
): string {
  if (type === 'video') return 'Open video';
  if (type === 'audio') return 'Open audio';
  return 'Open media';
}

export function stopMediaAttachmentPropagation(
  event: MediaAttachmentEvent,
): void {
  event.stopPropagation();
}

export function mediaAttachmentOpenAfterStop(
  event: MediaAttachmentEvent,
  open: () => void,
): void {
  stopMediaAttachmentPropagation(event);
  open();
}

export function openMediaAttachment(
  attachment: ContentAttachment,
  open: MediaAttachmentOpenAction,
): void {
  const plan = planMediaAttachmentOpen(attachment);
  open(plan.url, plan.target, plan.features);
}
