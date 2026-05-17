import type { NostrFilter } from '../protocol';

export type TileType =
  | 'timeline'
  | 'custom-filter'
  | 'relay-monitor'
  | 'composer';

export type RelayConfig = {
  readonly url: string;
  readonly read: boolean;
  readonly write: boolean;
};

export type Tile = {
  readonly id: string;
  readonly type: TileType;
  readonly title: string;
  readonly width: number;
  readonly order: number;
  readonly filters: readonly NostrFilter[];
  readonly relayUrls: readonly string[];
};

export type Deck = {
  readonly id: string;
  readonly name: string;
  readonly tiles: readonly Tile[];
  readonly updatedAt: number;
};

export type AppSettings = {
  readonly relays: readonly RelayConfig[];
  readonly activeDeck: Deck;
};
