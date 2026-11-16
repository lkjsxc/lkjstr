// Every live editor holds through the Worker's lock commit; expiry never grants permission to edit.
import type { FromEngine, ToEngine } from './protocol.ts';

type Hooks = {
  hold(value: boolean): void;
  suspend(): void;
  register(version: number): Promise<boolean>;
};
export function createDmFlushers(post: (message: ToEngine) => void = () => {}) {
  const writers = new Map<() => Promise<boolean>, { account: string; hooks?: Hooks }>(); // <=32
  const prepares = new Map<string, { account: string; generation: number; running: boolean }>(); // <=32
  let stopped = false,
    generation = 0,
    registering = false;
  const held = (account: string): boolean =>
    registering || [...prepares.values()].some((p) => p.account === account);
  const update = (account?: string): void => {
    for (const writer of writers.values())
      if (!account || writer.account === account) writer.hooks?.hold(held(writer.account));
  };
  const run = async (account: string): Promise<boolean> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const jobs = [...writers]
      .filter(([, writer]) => writer.account === account)
      .map(([flush]) => flush);
    try {
      return await Promise.race([
        (async () => {
          for (const flush of jobs) if (stopped || !(await flush())) return false;
          return !stopped;
        })(),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(resolve, 15_000, false);
        }),
      ]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
  const suspend = (): void => {
    if (stopped) return;
    generation++;
    prepares.clear();
    registering = true;
    for (const writer of writers.values()) writer.hooks?.suspend();
    update();
  };
  const ready = (version: number): void => {
    if (stopped) return;
    suspend();
    const lease = generation;
    void Promise.all([...writers.values()].map((writer) => writer.hooks?.register(version)))
      .catch(() => undefined)
      .finally(() => {
        if (stopped || generation !== lease) return;
        registering = false;
        update();
      });
  };
  return {
    suspend,
    add(account: string, flush: () => Promise<boolean>, hooks?: Hooks): (() => void) | undefined {
      if (stopped || writers.size >= 32) return undefined;
      writers.set(flush, { account, hooks });
      if (held(account)) hooks?.hold(true);
      return () => {
        writers.delete(flush);
      };
    },
    has: (account: string): boolean => [...writers.values()].some((w) => w.account === account),
    run,
    receive(message: Extract<FromEngine, { t: 'dm.flush' }>): void {
      if (stopped) return;
      const old = prepares.get(message.req);
      if (message.phase === 'release') {
        if (!old || old.account !== message.account) return;
        prepares.delete(message.req);
        update(message.account);
        return;
      }
      if (old && (old.account !== message.account || old.running)) return;
      if (!old && prepares.size >= 32) {
        post({ t: 'dm.flushed', req: message.req, ok: false });
        return;
      }
      const preparation = old ?? { account: message.account, generation, running: false };
      prepares.set(message.req, preparation);
      update(message.account);
      if (message.phase === 'hold') return;
      preparation.running = true;
      void run(message.account).then((ok) => {
        if (
          !stopped &&
          prepares.get(message.req) === preparation &&
          generation === preparation.generation
        )
          post({ t: 'dm.flushed', req: message.req, ok });
      });
    },
    ready,
    resume(version: number): void {
      if (!prepares.size) ready(version);
    },
    dispose(): void {
      stopped = true;
      generation++;
      prepares.clear();
      writers.clear();
    },
  };
}
