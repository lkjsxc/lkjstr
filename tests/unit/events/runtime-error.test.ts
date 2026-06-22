import { describe, expect, it } from 'vitest';
import { boundedErrorText } from '../../../src/lib/events/runtime-error';
import { rustWasmArtifactMissingMessage } from '../../../src/lib/rust-wasm/bridge-unavailable';

describe('runtime error text', () => {
  it('preserves normal product errors', () => {
    expect(boundedErrorText(new Error('Relay read failed.'))).toBe(
      'Relay read failed.',
    );
  });

  it('does not leak raw wasm-pack spawn errors into feed state', () => {
    const text = boundedErrorText(
      new Error('wasm-pack unavailable: spawnSync wasm-pack ENOENT'),
    );

    expect(text).toBe(rustWasmArtifactMissingMessage);
    expect(text).not.toContain('spawnSync');
    expect(text).not.toContain('ENOENT');
  });
});
