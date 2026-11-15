import type { Key } from '../shared/i18n.ts';
import { ROUTING, type RoutingKey } from './stats-routing.ts';

type PublishKey = 'publishAccepted' | 'publishPending' | 'publishOwnSkipped';
export type SortKey =
  | 'health'
  | 'events'
  | 'dup'
  | 'latency'
  | 'subs'
  | 'data'
  | PublishKey
  | RoutingKey;
export const PUBLISH = {
  publishAccepted: ['publishAccepted', 'publishPlanned'],
  publishPending: ['publishPending', 'publishFailed'],
  publishOwnSkipped: ['publishOwnSkipped', 'publishInboxSkipped', 'publishCapacitySkipped'],
} as const;
export const PUBLISH_KEYS = Object.keys(PUBLISH) as PublishKey[];
export const COLUMNS: readonly (readonly [SortKey, Key])[] = [
  ['health', 'stats.relay'],
  ...ROUTING.map((key) => [key, `stats.${key}`] as const),
  ['events', 'stats.events'],
  ['dup', 'stats.dup'],
  ['latency', 'stats.latency'],
  ['subs', 'stats.subs'],
  ['data', 'stats.data'],
  ...PUBLISH_KEYS.map((key) => [key, `stats.${key}`] as const),
];
