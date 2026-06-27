import { describe, expect, it } from 'vitest';
import {
  addCargoBinToPath,
  shouldBootstrapWasmToolchain,
} from '../../../scripts/install-wasm-toolchain';

describe('Cloudflare Rust/WASM toolchain bootstrap detection', () => {
  it('enables bootstrap inside Cloudflare build homes', () => {
    expect(
      shouldBootstrapWasmToolchain(
        { HOME: '/opt/buildhome' },
        '/opt/buildhome/repo',
      ),
    ).toBe(true);
    expect(shouldBootstrapWasmToolchain({ CF_PAGES: '1' }, '/workspace')).toBe(
      true,
    );
  });

  it('allows explicit opt in and opt out', () => {
    expect(
      shouldBootstrapWasmToolchain(
        { LKJSTR_BOOTSTRAP_WASM_TOOLCHAIN: '1' },
        '/workspace',
      ),
    ).toBe(true);
    expect(
      shouldBootstrapWasmToolchain(
        { LKJSTR_BOOTSTRAP_WASM_TOOLCHAIN: '0', HOME: '/opt/buildhome' },
        '/opt/buildhome/repo',
      ),
    ).toBe(false);
  });

  it('adds cargo bin to PATH once', () => {
    const env = { HOME: '/tmp/lkjstr-home', PATH: '/usr/bin' };
    addCargoBinToPath(env);
    addCargoBinToPath(env);

    expect(env.PATH).toBe('/tmp/lkjstr-home/.cargo/bin:/usr/bin');
  });
});
