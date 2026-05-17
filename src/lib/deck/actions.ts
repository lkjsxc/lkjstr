import { createTile } from './defaults';
import type { AppSettings, Deck, RelayConfig, TileType } from './types';

export function addRelay(
  settings: AppSettings,
  relay: RelayConfig,
): AppSettings {
  const relays = settings.relays.filter((item) => item.url !== relay.url);
  return { ...settings, relays: [...relays, relay] };
}

export function removeRelay(settings: AppSettings, url: string): AppSettings {
  return {
    ...settings,
    relays: settings.relays.filter((relay) => relay.url !== url),
  };
}

export function addTile(deck: Deck, type: TileType): Deck {
  const order = deck.tiles.length;
  return touch({ ...deck, tiles: [...deck.tiles, createTile(type, order)] });
}

export function removeTile(deck: Deck, id: string): Deck {
  return touch({
    ...deck,
    tiles: orderTiles(deck.tiles.filter((tile) => tile.id !== id)),
  });
}

export function moveTile(deck: Deck, id: string, direction: -1 | 1): Deck {
  const tiles = [...deck.tiles].sort((a, b) => a.order - b.order);
  const index = tiles.findIndex((tile) => tile.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= tiles.length) return deck;
  [tiles[index], tiles[target]] = [tiles[target], tiles[index]];
  return touch({ ...deck, tiles: orderTiles(tiles) });
}

export function resizeTile(deck: Deck, id: string, delta: number): Deck {
  const tiles = deck.tiles.map((tile) => {
    if (tile.id !== id) return tile;
    return { ...tile, width: Math.max(300, Math.min(720, tile.width + delta)) };
  });
  return touch({ ...deck, tiles });
}

function orderTiles(tiles: readonly Deck['tiles'][number][]): Deck['tiles'] {
  return tiles.map((tile, order) => ({ ...tile, order }));
}

function touch(deck: Deck): Deck {
  return { ...deck, updatedAt: Date.now() };
}
