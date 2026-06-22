import { describe, expect, it, vi } from 'vitest';
import { rustWasmArtifactMissingMessage } from '../../../src/lib/rust-wasm/bridge-unavailable';

vi.mock('virtual:lkjstr-web-wasm', () => ({
  loadLkjstrWebWasm: async () => {
    throw new Error('wasm-pack unavailable: spawnSync wasm-pack ENOENT');
  },
}));

const { loadScanModelWasmPlanner } =
  await import('../../../src/lib/feed-surface/scan-model-wasm');

describe('scan model WASM bridge loader', () => {
  it('returns explicit unavailable state without raw toolchain text', async () => {
    const result = await loadScanModelWasmPlanner();

    expect(result).toEqual({
      ok: false,
      reason: 'unavailable',
      message: rustWasmArtifactMissingMessage,
    });
    if (result.ok) throw new Error('bridge unexpectedly loaded');
    expect(result.message).not.toContain('spawnSync');
    expect(result.message).not.toContain('ENOENT');
  });
});
