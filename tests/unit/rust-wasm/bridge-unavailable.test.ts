import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  productSafeErrorMessage,
  rustWasmArtifactMissingMessage,
  rustWasmBridgeErrorMessage,
  rustWasmDiagnosticMessage,
} from '../../../src/lib/rust-wasm/bridge-unavailable';

describe('Rust/WASM bridge-unavailable presenter', () => {
  it('maps raw wasm-pack spawn failures to product-safe text', () => {
    const message = rustWasmBridgeErrorMessage(
      new Error('wasm-pack unavailable: spawnSync wasm-pack ENOENT'),
      'Home failed.',
    );

    expect(message).toBe(rustWasmArtifactMissingMessage);
    expect(message).not.toContain('spawnSync');
    expect(message).not.toContain('ENOENT');
  });

  it('keeps explicit bridge-unavailable states non-successful', () => {
    expect(rustWasmDiagnosticMessage('Rust Home bridge unavailable.')).toBe(
      'Rust Home bridge unavailable.',
    );
    expect(
      rustWasmBridgeErrorMessage('unrelated failure', 'Home failed.'),
    ).toBe('Home failed.');
    expect(productSafeErrorMessage('relay failed', 'fallback')).toBe(
      'relay failed',
    );
  });

  it('is used by feed and retained island hosts instead of raw error messages', () => {
    for (const path of bridgeHostFiles()) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).toContain('rustWasmBridgeErrorMessage');
      expect(source, path).not.toContain('? error.message');
      expect(source, path).not.toContain('? err.message');
    }
  });
});

function bridgeHostFiles(): string[] {
  return [
    'src/lib/components/workspace/RustIslandHost.svelte',
    'src/lib/tabs/search/SearchTab.svelte',
    'src/lib/tabs/custom-request/CustomRequestTab.svelte',
    'src/lib/tabs/notifications/NotificationsTab.svelte',
    'src/lib/tabs/thread/ThreadTab.svelte',
    'src/lib/tabs/profile/ProfileTab.svelte',
  ];
}
