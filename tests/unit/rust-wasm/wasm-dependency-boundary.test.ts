import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Rust/WASM dependency boundary', () => {
  it('keeps shipped bridge crypto free of secp256k1-sys clang builds', () => {
    const manifest = readFileSync('crates/lkjstr-protocol/Cargo.toml', 'utf8');
    const lockfile = readFileSync('Cargo.lock', 'utf8');

    expect(manifest).toContain('k256');
    expect(manifest).toContain('getrandom02');
    expect(manifest).not.toContain('secp256k1');
    expect(lockfile).not.toContain('name = "secp256k1-sys"');
  });
});
