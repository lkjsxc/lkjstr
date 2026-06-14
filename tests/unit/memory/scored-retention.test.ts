import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runtimeMemorySnapshot } from '../../../src/lib/memory/runtime-memory';
import {
  scoreRetentionCandidate,
  selectRetained,
} from '../../../src/lib/memory/scored-retention';
import { normalizeUserTimelineDiagnostics } from '../../../src/lib/memory/user-timeline-diagnostics';

describe('scored retention', () => {
  it('keeps high-signal ephemeral candidates first', () => {
    const retained = selectRetained(
      [
        { id: 'old', createdAt: 1 },
        { id: 'new', createdAt: 2 },
        { id: 'active', createdAt: 0, active: true },
      ],
      2,
    );

    expect(retained.map((item) => item.id)).toEqual(['active', 'new']);
    expect(scoreRetentionCandidate(retained[0]!)).toBeGreaterThan(
      scoreRetentionCandidate(retained[1]!),
    );
  });

  it('returns redacted runtime memory counts', () => {
    const snapshot = runtimeMemorySnapshot({
      status: 'available',
      outcomes: [{ key: 'ready', count: 2 }],
      reasons: [{ key: 'selected-relay', count: 1 }],
    });
    const text = JSON.stringify(snapshot);

    expect(snapshot).toMatchObject({
      appLogCount: expect.any(Number),
      relaySuppressionCount: expect.any(Number),
      fallbackRepository: expect.any(Object),
      caches: expect.any(Object),
      userTimeline: {
        status: 'available',
        outcomes: [{ key: 'ready', count: 2 }],
        reasons: [{ key: 'selected-relay', count: 1 }],
      },
    });
    expect(text).not.toContain('subId');
    expect(text).not.toContain('requestId');
    expect(text).not.toContain('rawEvent');
    expect(text).not.toContain('relayPayload');
  });

  it('normalizes malformed Rust User Timeline diagnostics as unavailable', () => {
    expect(normalizeUserTimelineDiagnostics({ status: 'ready' })).toMatchObject({
      status: 'unavailable',
      outcomes: [],
      reasons: [],
    });
  });

  it('does not import retained user timeline runtime counters into Stats', () => {
    const source = readFileSync('src/lib/memory/runtime-memory.ts', 'utf8');
    const bridge = readFileSync(
      'src/lib/memory/user-timeline-diagnostics.ts',
      'utf8',
    );

    expect(source).not.toContain('../user-timeline');
    expect(bridge).not.toContain('../user-timeline');
    expect(source).toContain('unavailableUserTimelineDiagnostics');
  });
});
