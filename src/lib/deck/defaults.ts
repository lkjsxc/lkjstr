import type { AppSettings, Deck, Tile, TileType } from './types';

export function createTile(type: TileType, order: number): Tile {
  const id = crypto.randomUUID();
  const title = titleFor(type);
  return {
    id,
    type,
    title,
    width: type === 'composer' ? 360 : 420,
    order,
    filters:
      type === 'timeline' || type === 'custom-filter'
        ? [{ kinds: [1], limit: 50 }]
        : [],
    relayUrls: [],
  };
}

export function createDefaultDeck(): Deck {
  const tiles = [
    createTile('timeline', 0),
    createTile('relay-monitor', 1),
    createTile('composer', 2),
  ];
  return {
    id: crypto.randomUUID(),
    name: 'Main deck',
    tiles,
    updatedAt: Date.now(),
  };
}

export function createDefaultSettings(): AppSettings {
  return { relays: [], activeDeck: createDefaultDeck() };
}

function titleFor(type: TileType): string {
  if (type === 'custom-filter') return 'Custom filter';
  if (type === 'relay-monitor') return 'Relay monitor';
  if (type === 'composer') return 'Composer';
  return 'Timeline';
}
