import { settingsChangedEvent } from './runtime-settings';

export function installWorkspaceSnapshotLifecycle(args: {
  readonly refreshSettings: () => void;
  readonly flushSnapshots: () => void;
}): () => void {
  const flushHidden = () => {
    if (document.visibilityState === 'hidden') args.flushSnapshots();
  };
  window.addEventListener(settingsChangedEvent, args.refreshSettings);
  window.addEventListener('pagehide', args.flushSnapshots);
  document.addEventListener('visibilitychange', flushHidden);
  return () => {
    window.removeEventListener(settingsChangedEvent, args.refreshSettings);
    window.removeEventListener('pagehide', args.flushSnapshots);
    document.removeEventListener('visibilitychange', flushHidden);
  };
}
