export type EventActionMode = 'none' | 'reply' | 'zap';

export function toggleEventActionMode(
  current: EventActionMode,
  target: Exclude<EventActionMode, 'none'>,
): EventActionMode {
  return current === target ? 'none' : target;
}
