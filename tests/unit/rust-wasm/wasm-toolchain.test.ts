import { describe, expect, it } from 'vitest';
import {
  LOCAL_WASM_ARTIFACT_MISSING_MESSAGE,
  preflightWasmPack,
} from '../../../scripts/wasm-toolchain';

describe('wasm-pack toolchain preflight', () => {
  it('reports missing wasm-pack with actionable non-product diagnostic', () => {
    const result = preflightWasmPack('wasm-pack', () => ({
      status: null,
      stdout: '',
      stderr: '',
      error: new Error('spawnSync wasm-pack ENOENT'),
    }));

    expect(result).toEqual({
      ok: false,
      productMessage: LOCAL_WASM_ARTIFACT_MISSING_MESSAGE,
      diagnostic:
        'Missing required Rust/WASM build tool: wasm-pack. Install it with cargo install wasm-pack --locked --version 0.15.0, or run Docker verification with docker compose.',
    });
    if (!result.ok) {
      expect(result.diagnostic).not.toContain('spawnSync');
      expect(result.diagnostic).not.toContain('ENOENT');
    }
  });

  it('allows rust-wasm checks to continue when wasm-pack is present', () => {
    const result = preflightWasmPack('wasm-pack', () => ({
      status: 0,
      stdout: 'wasm-pack 0.15.0',
      stderr: '',
    }));

    expect(result).toEqual({ ok: true, version: 'wasm-pack 0.15.0' });
  });
});
