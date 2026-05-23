export type RelayRouteSource =
  | 'selected'
  | 'nip65'
  | 'nip02'
  | 'event-hint'
  | 'event-receipt'
  | 'discovery';

export type RelayRoutePurpose = 'read' | 'write' | 'both';

export type RelayRoute = {
  readonly id: string;
  readonly authorPubkey: string;
  readonly relayUrl: string;
  readonly source: RelayRouteSource;
  readonly purpose: RelayRoutePurpose;
  readonly eventId?: string;
  readonly updatedAt: number;
};

export type RelayRouteGroup = {
  readonly key: string;
  readonly relays: readonly string[];
  readonly authors?: readonly string[];
  readonly source: RelayRouteSource | 'fallback';
};

export type RelayRouteBlock = {
  readonly relayUrl: string;
  readonly reason: 'user-removed' | 'user-disabled';
  readonly updatedAt: number;
};
