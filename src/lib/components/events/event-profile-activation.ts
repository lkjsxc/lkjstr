import {
  hasOpenProfileAction,
  type OpenProfileAction,
} from './action-availability';

type PropagationEvent = {
  stopPropagation: () => void;
};

export function eventProfileOpenLabel(): 'Open profile' {
  return 'Open profile';
}

export function eventProfileCanOpen(
  openProfile: OpenProfileAction,
): openProfile is (pubkey: string) => void {
  return hasOpenProfileAction(openProfile);
}

export function openEventProfile(
  openProfile: OpenProfileAction,
  pubkey: string,
): boolean {
  if (!eventProfileCanOpen(openProfile)) return false;
  openProfile(pubkey);
  return true;
}

export function stopAndOpenEventProfile(
  event: PropagationEvent,
  openProfile: OpenProfileAction,
  pubkey: string,
): boolean {
  event.stopPropagation();
  return openEventProfile(openProfile, pubkey);
}
