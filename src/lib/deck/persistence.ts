import { createDefaultSettings } from './defaults';
import type { AppSettings, Deck, RelayConfig, Tile } from './types';

const key = 'lkjstr.settings';

export function loadSettings(
  storage: Storage | undefined = browserStorage(),
): AppSettings {
  if (!storage) return createDefaultSettings();
  const raw = storage.getItem(key);
  if (!raw) return createDefaultSettings();
  return parseSettings(raw) ?? createDefaultSettings();
}

export function saveSettings(
  settings: AppSettings,
  storage: Storage | undefined = browserStorage(),
): void {
  storage?.setItem(key, JSON.stringify(settings));
}

function parseSettings(raw: string): AppSettings | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.relays) ||
      !isDeck(parsed.activeDeck)
    )
      return undefined;
    const relays = parsed.relays.filter(isRelay);
    return { relays, activeDeck: parsed.activeDeck };
  } catch {
    return undefined;
  }
}

function isDeck(value: unknown): value is Deck {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string'
  )
    return false;
  if (!Array.isArray(value.tiles) || typeof value.updatedAt !== 'number')
    return false;
  return value.tiles.every(isTile);
}

function isTile(value: unknown): value is Tile {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.title === 'string' &&
    typeof value.width === 'number' &&
    typeof value.order === 'number' &&
    Array.isArray(value.filters) &&
    Array.isArray(value.relayUrls)
  );
}

function isRelay(value: unknown): value is RelayConfig {
  if (!isRecord(value)) return false;
  return (
    typeof value.url === 'string' &&
    typeof value.read === 'boolean' &&
    typeof value.write === 'boolean'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function browserStorage(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}
