import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Port = { sent: unknown[]; closed: boolean; postMessage(value: unknown): void; close(): void };
type Connect = { ports: Port[] };
function port(): Port {
  return {
    sent: [],
    closed: false,
    postMessage(value) {
      this.sent.push(value);
    },
    close() {
      this.closed = true;
    },
  };
}
function entry(kind: 'shared' | 'worker') {
  const timers = new Set<() => void>();
  const deadlines = new Map<() => void, number>();
  let closed = false;
  let starts = 0;
  const attached: Connect[] = [];
  const scope: {
    onconnect?: (event: Connect) => void;
    onmessage?: (event: Connect) => void;
    close(): void;
  } = {
    close: () => {
      closed = true;
    },
  };
  let finish!: () => void;
  let fail!: (error: Error) => void;
  const pending = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const name = kind === 'shared' ? 'onconnect' : 'onmessage';
  const start = () => {
    starts++;
    scope[name] = (event) => attached.push(event);
    return {};
  };
  const source = readFileSync(resolve('..', 'engine', `${kind}.js`), 'utf8').replace(
    /^import .*;\n/m,
    '',
  );
  const task: Promise<void> = runInNewContext(`(async () => { ${source} })()`, {
    self: scope,
    init: () => pending,
    start_shared: start,
    start_port_host: start,
    setInterval: (fn: () => void) => {
      timers.add(fn);
      return fn;
    },
    clearInterval: (fn: () => void) => timers.delete(fn),
    setTimeout: (fn: () => void, ms: number) => {
      deadlines.set(fn, ms);
      return fn;
    },
    clearTimeout: (fn: () => void) => deadlines.delete(fn),
  });
  return {
    finish,
    fail,
    task,
    timers,
    deadlines,
    closed: () => closed,
    starts: () => starts,
    attached,
    connect: (event: Connect) => scope[name]?.(event),
  };
}

describe.each(['shared', 'worker'] as const)('%s bootstrap ownership', (kind) => {
  it('keeps a progressing long boot alive and replays each original port once', async () => {
    const f = entry(kind),
      first = port(),
      second = port();
    const events = [{ ports: [first] }, { ports: [second] }];
    for (const event of events) f.connect(event);
    for (let i = 0; i < 9; i++) for (const tick of f.timers) tick();
    expect(first.sent.length).toBeGreaterThan(8);
    expect(first.sent.every((message) => JSON.stringify(message) === '{"t":"heartbeat"}')).toBe(
      true,
    );
    expect(f.attached).toEqual([]);
    f.finish();
    await f.task;
    expect(f.attached).toEqual(events);
    expect(f.timers.size).toBe(0);
    expect(f.deadlines.size).toBe(0);
    expect(first.closed || second.closed).toBe(false);
  });
  it('bounds waiting ports to the real host capacity', async () => {
    const f = entry(kind),
      ports = Array.from({ length: 33 }, port);
    for (const p of ports) f.connect({ ports: [p] });
    expect(ports[32]?.closed).toBe(true);
    f.finish();
    await f.task;
    expect(f.attached).toHaveLength(32);
  });
  it('releases bootstrap timers and ports after initialization failure', async () => {
    const f = entry(kind),
      p = port();
    f.connect({ ports: [p] });
    const failure = expect(f.task).rejects.toThrow('failed init');
    f.fail(new Error('failed init'));
    await failure;
    expect(f.timers.size).toBe(0);
    expect(f.deadlines.size).toBe(0);
    expect(p.closed).toBe(true);
    expect(f.attached).toEqual([]);
  });

  it('terminates a stalled bootstrap and cannot start after its late resolution', async () => {
    const f = entry(kind),
      p = port();
    f.connect({ ports: [p] });
    expect([...f.deadlines.values()]).toEqual([15 * 60_000]);
    const outcome = expect(f.task).rejects.toThrow('engine startup timed out');
    for (const expire of f.deadlines.keys()) expire();
    await outcome;
    expect(p.closed).toBe(true);
    expect(f.closed()).toBe(true);
    expect(f.timers.size).toBe(0);
    expect(f.deadlines.size).toBe(0);
    expect(f.starts()).toBe(0);
    f.finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(f.starts()).toBe(0);
    expect(f.attached).toEqual([]);
  });
});
