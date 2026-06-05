import { loadSettings } from '$lib/settings/settings-store';
import {
  appendClientTag,
  type ClientTagConfig,
  type UnsignedNostrEvent,
} from '../protocol';

export async function clientTaggedEvent(
  event: UnsignedNostrEvent,
): Promise<UnsignedNostrEvent> {
  const settings = await loadSettings();
  const config = configFromSettings(
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
  );
  return { ...event, tags: appendClientTag(event.tags, config, event.kind) };
}

function configFromSettings(
  settings: Record<string, unknown>,
): ClientTagConfig {
  return {
    enabled: settings['publish.clientTag.enabled'] === true,
    name: text(settings['publish.clientTag.name']) || 'lkjstr',
    address: text(settings['publish.clientTag.address']),
    relay: text(settings['publish.clientTag.relay']),
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
