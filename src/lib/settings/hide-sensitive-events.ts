import { settingsChangedEvent } from './settings-events';
import { loadSettings } from './settings-store';

let cache: boolean | undefined;
let loading: Promise<boolean> | undefined;
let listening = false;
const listeners = new Set<(value: boolean) => void>();

export function subscribeHideSensitiveEvents(
  listener: (value: boolean) => void,
): () => void {
  listeners.add(listener);
  startWindowListener();
  if (cache !== undefined) listener(cache);
  else void refreshHideSensitiveEvents();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopWindowListener();
  };
}

export function notifyHideSensitiveSettingChanged(): void {
  loading = undefined;
  void refreshHideSensitiveEvents();
}

async function refreshHideSensitiveEvents(): Promise<void> {
  loading ??= loadSettings().then((settings) => {
    const setting = settings.find(
      (item) => item.key === 'content.hideSensitiveEvents',
    );
    return setting?.value !== false;
  });
  const value = await loading;
  cache = value;
  listeners.forEach((listener) => listener(value));
}

function startWindowListener(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener(
    settingsChangedEvent,
    notifyHideSensitiveSettingChanged,
  );
}

function stopWindowListener(): void {
  if (!listening || typeof window === 'undefined') return;
  listening = false;
  window.removeEventListener(
    settingsChangedEvent,
    notifyHideSensitiveSettingChanged,
  );
}
