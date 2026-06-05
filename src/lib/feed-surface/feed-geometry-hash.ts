export type ContentShapeInput = {
  readonly contentLength: number;
  readonly unicodeScalarCount: number;
  readonly lineBreakCount: number;
  readonly longestUnbrokenTokenLength: number;
  readonly urlCount: number;
  readonly mediaCount: number;
  readonly referencePreviewCount: number;
  readonly customEmojiCount: number;
  readonly hasContentWarning: boolean;
  readonly fragmentCount: number;
};

const fnvOffset = 0xcbf29ce484222325n;
const fnvPrime = 0x00000100000001b3n;

export function contentShapeHash(input: ContentShapeInput): string {
  let state = fnvOffset;
  state = foldU32(state, input.contentLength);
  state = foldU32(state, input.unicodeScalarCount);
  state = foldU16(state, input.lineBreakCount);
  state = foldU32(state, input.longestUnbrokenTokenLength);
  state = foldU16(state, input.urlCount);
  state = foldU16(state, input.mediaCount);
  state = foldU16(state, input.referencePreviewCount);
  state = foldU16(state, input.customEmojiCount);
  state = foldByte(state, input.hasContentWarning ? 1 : 0);
  state = foldU16(state, input.fragmentCount);
  return state.toString(16).padStart(16, '0');
}

function foldU32(state: bigint, value: number): bigint {
  let next = state;
  const safe = BigInt(clampInteger(value, 0xffffffff));
  for (let shift = 0n; shift < 32n; shift += 8n)
    next = foldByte(next, Number((safe >> shift) & 0xffn));
  return next;
}

function foldU16(state: bigint, value: number): bigint {
  let next = state;
  const safe = BigInt(clampInteger(value, 0xffff));
  for (let shift = 0n; shift < 16n; shift += 8n)
    next = foldByte(next, Number((safe >> shift) & 0xffn));
  return next;
}

function foldByte(state: bigint, byte: number): bigint {
  return BigInt.asUintN(64, (state ^ BigInt(byte)) * fnvPrime);
}

function clampInteger(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.floor(value)));
}
