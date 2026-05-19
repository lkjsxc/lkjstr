import { loadSettings } from '$lib/settings/settings-store';
export { settingsChangedEvent } from '$lib/settings/settings-events';

export async function loadInactiveRetentionSeconds(
  fallback = 300,
): Promise<number> {
  const retention = (await loadSettings()).find(
    (setting) => setting.key === 'tabs.inactiveRetentionSeconds',
  )?.value;
  return typeof retention === 'number' ? retention : fallback;
}
