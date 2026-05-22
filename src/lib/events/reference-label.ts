import type { EventReference } from '../protocol';

export function eventReferenceLabel(reference: EventReference): string {
  if (reference.kind === 'reply-parent') return 'Replying to';
  if (reference.kind === 'reply-root') return 'Thread root';
  if (reference.kind === 'quote') return 'Quoted event';
  if (reference.kind === 'repost') return 'Reposted event';
  if (reference.kind === 'reaction') return 'Reacted to';
  if (reference.kind === 'deletion') return 'Deleted target';
  return 'Referenced event';
}
