import { describe, expect, it } from 'vitest';
import {
  asciiToBytes,
  bytesToAscii,
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  tryHexToBytes,
  utf8ToBytes,
} from '../../../src/lib/protocol';

describe('protocol bytes', () => {
  it('encodes lowercase hex and decodes strict hex', () => {
    expect(bytesToHex(Uint8Array.from([0, 15, 255]))).toBe('000fff');
    expect(hexToBytes('000fff')).toEqual(Uint8Array.from([0, 15, 255]));
    expect(tryHexToBytes('AA')).toBeUndefined();
    expect(tryHexToBytes('abc')).toBeUndefined();
  });

  it('roundtrips UTF-8 and validates ASCII', () => {
    expect(bytesToUtf8(utf8ToBytes('hello \u2713'))).toBe('hello \u2713');
    expect(asciiToBytes('abc')).toEqual(Uint8Array.from([97, 98, 99]));
    expect(asciiToBytes('\u2713')).toBeUndefined();
    expect(bytesToAscii(Uint8Array.from([0x61, 0xff]))).toBeUndefined();
  });
});
