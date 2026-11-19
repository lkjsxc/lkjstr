import type { PatchOp, Query } from '../protocol.ts';
import type { Entry } from './query.ts';

export type Sub = {
  readonly id: string;
  readonly query: Query;
  entries: Entry[];
  start: number;
  end: number;
  live: boolean;
  windowed: boolean;
  fresh: number;
  ops: PatchOp[];
  timeline?: string;
  anchor?: string;
  returnKey?: string;
  searchRange?: { before: number; after: number; retainAbove: boolean };
  liveRange?: { before: number; after: number };
};
