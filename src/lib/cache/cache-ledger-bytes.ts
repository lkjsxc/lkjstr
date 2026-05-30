import { encodedJsonBytes } from './cache-byte-size';

export function cacheLedgerBytes(row: unknown): number {
  return encodedJsonBytes(row);
}
