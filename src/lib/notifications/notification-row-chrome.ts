import type { NotificationRecord } from './notification';
import { notificationActionLabel } from './notification-presentation';

export type NotificationRowChrome =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'normal';
      readonly label: string;
      readonly showActor: boolean;
      readonly showTime: boolean;
    }
  | { readonly kind: 'compact-fallback'; readonly text: string };

export function notificationRowChrome(input: {
  readonly record: NotificationRecord;
  readonly hasSourceItem: boolean;
  readonly sourceShowsActor: boolean;
}): NotificationRowChrome {
  if (input.record.kind === 'reaction' && input.hasSourceItem) {
    return { kind: 'hidden' };
  }
  if (input.record.kind === 'reaction') {
    return { kind: 'compact-fallback', text: 'Reaction event unavailable.' };
  }
  return {
    kind: 'normal',
    label: notificationActionLabel(input.record.kind),
    showActor: !input.sourceShowsActor,
    showTime: true,
  };
}
