// The mock engine as the worker a mock build ships: the same message boundary the real engine has.
import type { ToEngine } from '../protocol.ts';
import { createMockEngine } from './engine.ts';

const scope = self as unknown as {
  postMessage(msg: unknown): void;
  onmessage: ((e: MessageEvent<ToEngine>) => void) | null;
};
const engine = createMockEngine((msg) => scope.postMessage(msg));
scope.onmessage = (e) => engine.handle(e.data);
