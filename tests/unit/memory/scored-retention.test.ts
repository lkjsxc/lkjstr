import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runtimeMemorySnapshot } from '../../../src/lib/memory/runtime-memory';
import {
  scoreRetentionCandidate,
  selectRetained,
} from '../../../src/lib/memory/scored-retention';

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
    const snapshot = runtimeMemorySnapshot();
    const text = JSON.stringify(snapshot);

    expect(snapshot).toMatchObject({
      appLogCount: expect.any(Number),
      relaySuppressionCount: expect.any(Number),
      fallbackRepository: expect.any(Object),
      caches: expect.any(Object),
      userTimeline: {
        status: 'unavailable',
        outcomes: [],
        reasons: [],
      },
    });
    expect(text).not.toContain('subId');
    expect(text).not.toContain('requestId');
    expect(text).not.toContain('rawEvent');
    expect(text).not.toContain('relayPayload');
  });

  it('does not import retained user timeline runtime counters into Stats', () => {
    const source = readFileSync('src/lib/memory/runtime-memory.ts', 'utf8');

    expect(source).not.toContain('../user-timeline');
    expect(source).toContain('unavailableUserTimelineDiagnostics');
  });
});
