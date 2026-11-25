// What the Orchestration tab reads from `stats`, and what Stage-safe lets it draw.
// The fields beyond `EngineStats` are the optional additions listed in docs/interface-specs.md (O1): each is read
// only when present, and an absent one is drawn as a dash or its part is left out, never guessed.
import type {
  BandwidthBucket,
  EngineStats,
  OrchestrationEvent,
  OrchestrationView,
  OrchestrationWorker,
  Source,
} from '../engine/protocol.ts';
import { getLang, hasKey, type Key, t } from '../shared/i18n.ts';

export type OrchRequest = NonNullable<EngineStats['requests']>[number] & {
  readonly memberSubs?: readonly string[];
  readonly role?: 'primary' | 'hedge' | 'fallback';
  readonly createdAtMs?: number;
  readonly firstEventAtMs?: number | null;
  readonly hedgeDueAtMs?: number | null;
};
export type OrchRelay = EngineStats['relays'][number] & {
  readonly relayIndex?: number;
  readonly eoseMs?: number | null;
  readonly usefulShare?: number | null;
};
export type OrchView = OrchestrationView & {
  readonly sourceKind?: Source;
  readonly oldestAtMs?: number;
  readonly newestAtMs?: number;
  readonly cacheOldestAtMs?: number;
  readonly cacheNewestAtMs?: number;
};
export type OrchWorker = OrchestrationWorker & {
  readonly lastSliceVerified?: number;
  readonly verifyQueueCap?: number;
  readonly storeEvictions?: number;
  readonly ghostHits?: number;
  readonly payloadBytes?: number;
  readonly replaceableCap?: number;
  readonly regularCap?: number;
};
export type OrchBucket = BandwidthBucket & {
  readonly reqsCoalesced?: number;
  readonly hedgesFired?: number;
  readonly duplicateBytes?: number;
  readonly queueBusy?: boolean;
};
export type OrchEvent = Omit<OrchestrationEvent, 'kind'> & {
  readonly kind: OrchestrationEvent['kind'] | 'trip' | 'explore';
  readonly viewSubId?: string;
  readonly count?: number;
  readonly delayMs?: number;
};
export type OptimizerMode = 'off' | 'shadow' | 'on';
export type KeepItem = {
  readonly class: string;
  readonly weightClass: number;
  readonly ageH: number;
  readonly bytes: number;
  readonly score: number;
  readonly pin?: 'own' | 'deletion' | 'window' | 'context';
};
export type Optimizer = {
  readonly stage: number;
  readonly parts?: readonly {
    readonly id: string;
    readonly mode: OptimizerMode;
    readonly trippedUntilMs?: number | null;
  }[];
  readonly variables?: readonly {
    readonly id: string;
    readonly value: number | boolean;
    readonly unit?: string;
    readonly source: 'fixed' | 'measured' | 'learned';
    readonly stage1Value?: number | boolean;
  }[];
  readonly weightClasses?: readonly { readonly weight: number; readonly count: number }[];
  readonly keep?: { readonly low: readonly KeepItem[]; readonly high: readonly KeepItem[] };
};
export type OrchStats = Omit<
  EngineStats,
  'views' | 'worker' | 'requests' | 'relays' | 'bandwidthHistory' | 'orchestrationEvents'
> & {
  readonly nowMs?: number;
  readonly views?: readonly OrchView[];
  readonly worker?: OrchWorker;
  readonly requests?: readonly OrchRequest[];
  readonly relays: readonly OrchRelay[];
  readonly bandwidthHistory?: readonly OrchBucket[];
  readonly orchestrationEvents?: readonly OrchEvent[];
  readonly optimizer?: Optimizer;
};

export const NONE = '—';
export const num = (n: number): string =>
  n.toLocaleString(getLang() === 'ja' ? 'ja-JP' : 'en-US', { maximumFractionDigits: 1 });
export const put = (el: Element, text: string): void => {
  if (el.textContent !== text) el.textContent = text;
};

const PRIVATE_HOST =
  /(^|\.)localhost$|\.(local|lan|home|internal|onion)$|^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)|^\[(::1\]|f[cd]|fe[89ab])/;
/** The host, and a port only when it is not the scheme's own. Nothing else of the address is ever drawn. */
export function hostLabel(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.host || undefined;
  } catch {
    return undefined;
  }
}
export const isPrivate = (url: string, flagged?: boolean): boolean => {
  if (flagged || url === 'private-relay') return true;
  const host = hostLabel(url);
  return host === undefined || PRIVATE_HOST.test(host.replace(/:\d+$/, ''));
};
/** The reader's own list: the only private relays drawn by host, and only with Stage-safe off. */
const own = (r: OrchRelay): boolean =>
  r.readRule === 'reader' || r.route === 'own' || r.route === 'writing' || r.route === 'both';

export type RelayLine = {
  readonly key: string;
  readonly label: string;
  readonly isPrivate: boolean;
  readonly members: readonly OrchRelay[];
};
/** Relay rows as drawn: with Stage-safe on, every private relay is one summed row and no private host appears. */
export function relayLines(relays: readonly OrchRelay[], safe: boolean): RelayLine[] {
  const shown: RelayLine[] = [];
  const hidden: OrchRelay[] = [];
  for (const r of relays) {
    const priv = isPrivate(r.url, r.isPrivateHost);
    if (priv && (safe || !own(r))) hidden.push(r);
    else
      shown.push({
        key: r.url,
        label: hostLabel(r.url) ?? t('orch.privateRelay'),
        isPrivate: priv,
        members: [r],
      });
  }
  if (hidden.length)
    shown.push({
      key: 'private',
      label: t('orch.privateRelays', { n: hidden.length }),
      isPrivate: true,
      members: hidden,
    });
  return shown;
}
/** A relay named in an event or a request: its host when public, otherwise only that it is private. */
export function relayWord(
  url: string | undefined,
  relays: readonly OrchRelay[],
  safe: boolean,
): string {
  if (!url) return '';
  const known = relays.find((r) => r.url === url);
  const priv = isPrivate(url, known?.isPrivateHost);
  if (!priv || (!safe && known && own(known))) return hostLabel(url) ?? t('orch.privateRelay');
  return t('orch.privateRelay');
}

const SOURCE_WORD: Partial<Record<Source, Key>> = {
  relay: 'orch.relays',
  people: 'orch.otherView',
};
/** A view by its kind alone (Home, Thread, Profile, Moment 11/24 21:03): never a name, query or account. */
export function viewWord(v: OrchView, when: (ms: number) => string): string {
  if (v.windowKind === 'at' && v.anchorAtMs !== undefined)
    return t('orch.moment', { time: when(v.anchorAtMs) });
  const kind = v.sourceKind ?? v.source;
  const key = SOURCE_WORD[kind] ?? `view.${kind}`;
  return hasKey(key) ? t(key) : t('orch.otherView');
}
