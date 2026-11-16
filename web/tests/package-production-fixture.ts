// Valid, inert WASM and bindings for the release boundary. Never instantiate them.
export const productionBindings = `export class WorkerHandle { stop() {} }
export class SharedWorkerHandle { stop() {} }
export function start() {} export function start_port_host() {} export function start_shared() {}
new URL('./renamed-data.wasm', import.meta.url);`;
const leb = (initial: number): number[] => {
  const bytes: number[] = [];
  let value = initial;
  do {
    const low = value & 127;
    value >>>= 7;
    bytes.push(low | (value ? 128 : 0));
  } while (value);
  return bytes;
};
export function productionWasm(extra: string[] = []): Buffer {
  const section = (id: number, data: number[]) => [id, ...leb(data.length), ...data];
  const names = [
    'start',
    'start_port_host',
    'start_shared',
    'workerhandle_stop',
    'sharedworkerhandle_stop',
    ...extra,
  ];
  return Buffer.from([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    ...section(1, [1, 96, 0, 0]),
    ...section(3, [1, 0]),
    ...section(7, [
      ...leb(names.length),
      ...names.flatMap((name) => {
        const bytes = [...new TextEncoder().encode(name)];
        return [...leb(bytes.length), ...bytes, 0, 0];
      }),
    ]),
    ...section(10, [1, 2, 0, 11]),
  ]);
}
