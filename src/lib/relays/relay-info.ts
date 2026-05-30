import type { RelayInformationDocument } from './relay-info-types';
import { relayInformation } from './relay-info-store';

export type {
  RelayInformationDocument,
  RelayInformationRecord,
  RelayLimitation,
} from './relay-info-types';
export { parseRelayInformation } from './relay-info-parse';
export { fetchRelayInformation, relayHttpUrl } from './relay-info-fetch';
export {
  cachedRelayInformation,
  clearRelayInformationMemoryForTests,
  listRelayInformation,
  relayInformation,
  relayInformationMemorySizeForTests,
  saveRelayInformation,
} from './relay-info-store';

export function relayRequestLimit(
  requested: number,
  info: RelayInformationDocument | undefined,
): number {
  const cap = info?.limitation?.maxLimit;
  if (typeof cap !== 'number' || cap < 1) return Math.max(1, requested);
  return Math.max(1, Math.min(requested, cap));
}

export async function relayMaySupportNip50(relayUrl: string): Promise<boolean> {
  const record = await relayInformation(relayUrl);
  if (record?.status !== 'available') return true;
  const nips = record.info?.supported_nips;
  return !nips || nips.includes(50);
}
