export type OlderLoadMode = 'auto-near-end' | 'after-user-scroll' | 'explicit';

export type OlderLoadTrigger =
  | 'scroll'
  | 'near-end'
  | 'viewport-fill'
  | 'explicit';

export function canRequestOlder(input: {
  readonly mode?: OlderLoadMode;
  readonly trigger: OlderLoadTrigger;
  readonly userScrolledDown: boolean;
}): boolean {
  if (input.trigger === 'explicit') return true;
  if (input.mode === 'explicit') return false;
  if (input.mode === 'after-user-scroll')
    return input.trigger === 'scroll' && input.userScrolledDown;
  return true;
}
