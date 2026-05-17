import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addRelay,
  addTile,
  moveTile,
  removeRelay,
  removeTile,
  resizeTile,
} from '../../../src/lib/deck/actions';
import {
  createDefaultDeck,
  createDefaultSettings,
  createTile,
} from '../../../src/lib/deck/defaults';
import { loadSettings, saveSettings } from '../../../src/lib/deck/persistence';
import type {
  AppSettings,
  Deck,
  RelayConfig,
  Tile,
} from '../../../src/lib/deck/types';

const now = new Date('2026-01-02T03:04:05Z');

function tile(id: string, order: number, overrides: Partial<Tile> = {}): Tile {
  return {
    id,
    type: 'timeline',
    title: id,
    width: 420,
    order,
    filters: [],
    relayUrls: [],
    ...overrides,
  };
}

function deck(tiles: readonly Tile[] = [tile('one', 0), tile('two', 1)]): Deck {
  return { id: 'deck', name: 'Main', tiles, updatedAt: 1 };
}

function settings(relays: readonly RelayConfig[] = []): AppSettings {
  return { relays, activeDeck: deck() };
}

class MemoryStorage implements Storage {
  #items = new Map<string, string>();
  get length(): number {
    return this.#items.size;
  }
  clear(): void {
    this.#items.clear();
  }
  getItem(key: string): string | null {
    return this.#items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.#items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.#items.set(key, value);
  }
}

describe('deck helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates tiles with type-specific defaults', () => {
    expect(createTile('composer', 2)).toMatchObject({
      type: 'composer',
      title: 'Composer',
      width: 360,
      order: 2,
      filters: [],
      relayUrls: [],
    });
    expect(createTile('timeline', 0)).toMatchObject({
      title: 'Timeline',
      width: 420,
      filters: [{ kinds: [1], limit: 50 }],
    });
  });

  it('creates default deck settings', () => {
    const created = createDefaultSettings();

    expect(created.relays).toEqual([]);
    expect(created.activeDeck).toMatchObject({
      name: 'Main deck',
      updatedAt: now.getTime(),
    });
    expect(created.activeDeck.tiles.map((item) => item.type)).toEqual([
      'timeline',
      'relay-monitor',
      'composer',
    ]);
  });

  it('adds and removes relay configs immutably', () => {
    const original = settings([
      { url: 'wss://one.example/', read: true, write: false },
      { url: 'wss://two.example/', read: true, write: true },
    ]);

    const added = addRelay(original, {
      url: 'wss://one.example/',
      read: false,
      write: true,
    });

    expect(added.relays).toEqual([
      { url: 'wss://two.example/', read: true, write: true },
      { url: 'wss://one.example/', read: false, write: true },
    ]);
    expect(removeRelay(added, 'wss://two.example/').relays).toEqual([
      { url: 'wss://one.example/', read: false, write: true },
    ]);
    expect(original.relays[0]).toEqual({
      url: 'wss://one.example/',
      read: true,
      write: false,
    });
  });

  it('adds, removes, and moves tiles while reordering the deck', () => {
    const withTile = addTile(deck(), 'relay-monitor');

    expect(withTile.updatedAt).toBe(now.getTime());
    expect(withTile.tiles.at(-1)).toMatchObject({
      type: 'relay-monitor',
      order: 2,
    });

    expect(removeTile(withTile, 'one').tiles.map((item) => item.order)).toEqual(
      [0, 1],
    );
    expect(moveTile(deck(), 'two', -1).tiles.map((item) => item.id)).toEqual([
      'two',
      'one',
    ]);
    const boundary = deck();
    expect(moveTile(boundary, 'one', -1)).toBe(boundary);
  });

  it('clamps tile resizing', () => {
    expect(
      resizeTile(deck([tile('wide', 0, { width: 700 })]), 'wide', 50).tiles[0]
        ?.width,
    ).toBe(720);
    expect(
      resizeTile(deck([tile('narrow', 0, { width: 320 })]), 'narrow', -50)
        .tiles[0]?.width,
    ).toBe(300);
  });

  it('persists valid settings and falls back from invalid storage', () => {
    const storage = new MemoryStorage();
    const saved = settings([
      { url: 'wss://relay.example/', read: true, write: false },
    ]);

    saveSettings(saved, storage);
    expect(loadSettings(storage)).toEqual(saved);

    storage.setItem(
      'lkjstr.settings',
      JSON.stringify({ ...saved, relays: [...saved.relays, { url: 'bad' }] }),
    );
    expect(loadSettings(storage).relays).toEqual(saved.relays);

    storage.setItem('lkjstr.settings', '{bad json');
    expect(loadSettings(storage).activeDeck.name).toBe(
      createDefaultDeck().name,
    );
  });
});
