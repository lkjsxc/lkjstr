export type OpenThreadAction = ((eventId: string) => void) | undefined;
export type OpenProfileAction = ((pubkey: string) => void) | undefined;

export function hasOpenThreadAction(
  action: OpenThreadAction,
): action is (eventId: string) => void {
  return typeof action === 'function';
}

export function hasOpenProfileAction(
  action: OpenProfileAction,
): action is (pubkey: string) => void {
  return typeof action === 'function';
}
