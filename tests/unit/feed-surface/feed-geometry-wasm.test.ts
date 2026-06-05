import { describe, expect, it } from 'vitest';
import { featuresForFeedItem } from '../../../src/lib/feed-surface/feed-geometry-features';
import { createFeedGeometryWasmBridge } from '../../../src/lib/feed-surface/feed-geometry-wasm';

function eventRow(content: string) {
  return {
    kind: 'event' as const,
    node: {
      depth: 1,
      event: {
        id: 'a'.repeat(64),
        pubkey: 'b'.repeat(64),
        created_at: 1,
        kind: 1,
        tags: [],
        content,
        sig: 'c'.repeat(128),
      },
      relays: ['wss://relay.example'],
    },
  };
}

describe('feed geometry WASM bridge wrapper', () => {
  it('maps host features to the Rust bridge shape', () => {
    let received: unknown;
    const bridge = createFeedGeometryWasmBridge({
      estimate_feed_row_height_from_js: (input) => {
        received = input;
        return { estimated_height_px: 321 };
      },
    });
    const height = bridge.estimateHeight({
      key: 'row',
      features: featuresForFeedItem(eventRow('hello'), 640),
    });

    expect(height).toBe(321);
    expect(received).toMatchObject({
      key: 'row',
      features: { row_kind: 'event', content_length: 5, width_bucket: 3 },
      models: [],
    });
  });

  it('returns unavailable when an export is missing', () => {
    const bridge = createFeedGeometryWasmBridge({});

    expect(
      bridge.estimateHeight({
        key: 'row',
        features: featuresForFeedItem(eventRow('hello'), 640),
      }),
    ).toBeUndefined();
  });
});
