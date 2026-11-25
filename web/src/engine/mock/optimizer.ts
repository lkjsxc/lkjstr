import type { OrchestrationKeepItem, OrchestrationOptimizer } from '../protocol.ts';

export function mockOptimizer(events: number, now: number): OrchestrationOptimizer {
  const saturated = Math.floor(now / 1000) % 19 > 14;
  const values = [
    ['fanout', saturated ? 1 : 2, ''],
    ['hedgeDelay', 320, 'ms'],
    ['hedgeTarget', 2, ''],
    ['limit', saturated ? 100 : 200, 'events'],
    ['chunk', saturated ? 200 : 400, 'authors'],
    ['prefetch', saturated ? 0 : 1, 'pages'],
    ['throughput', 2_940_000, 'B/s'],
    ['rtt', 68, 'ms'],
    ['saturated', saturated, ''],
  ] as const;
  const weights = [0, 1, 8, 16, 32, 64];
  const item = (i: number): OrchestrationKeepItem => ({
    class: i % 3 === 0 ? 'profile' : i % 3 === 1 ? 'note' : 'repost',
    weightClass: weights[i % weights.length]!,
    ageH: (i * 47) % 300,
    bytes: 240 + ((i * 31) % 19) * 110,
    score: (i + 1) / 100,
    ...(i > 42 && { pin: i % 2 ? 'window' : 'own' }),
  });
  const count = Math.min(events, 48);
  return {
    stage: 1,
    parts: ['route', 'hedge', 'prefetch', 'keep'].map((id) => ({
      id,
      mode: 'off',
      trippedUntilMs: null,
      tripReason: null,
    })),
    link: { throughputBps: 2_940_000, rttMs: 68, saturated, samples: 27 },
    variables: values.map(([id, value, unit]) => ({ id, value, unit, source: 'measured' })),
    weightClasses: weights.map((weight, i) => ({
      weight,
      count: Math.floor(events / weights.length) + Number(i < events % weights.length),
    })),
    keep: {
      low: Array.from({ length: Math.min(8, count) }, (_, i) => item(i)),
      high: Array.from({ length: Math.min(8, count) }, (_, i) => item(count - i - 1)),
    },
    shadow: { decisions: 0, agreements: 0, brierStage1: null, brierStage2: null },
  };
}
