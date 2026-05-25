import { describe, expect, test } from 'vitest';
import { createResourceScope } from '../../../src/lib/fp/resource-scope';

describe('createResourceScope', () => {
  test('adds and runs cleanups in reverse order', () => {
    const scope = createResourceScope();
    const order: number[] = [];
    scope.add(() => order.push(1));
    scope.add(() => order.push(2));
    scope.close();
    expect(order).toEqual([2, 1]);
  });

  test('close is idempotent', () => {
    const scope = createResourceScope();
    let count = 0;
    scope.add(() => count++);
    scope.close();
    scope.close();
    expect(count).toBe(1);
  });

  test('clears timers on close', () => {
    const scope = createResourceScope();
    let fired = false;
    scope.timer(() => {
      fired = true;
    }, 10);
    scope.close();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(fired).toBe(false);
        resolve();
      }, 50);
    });
  });

  test('clears intervals on close', () => {
    const scope = createResourceScope();
    let count = 0;
    scope.interval(() => {
      count++;
    }, 5);
    scope.close();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(count).toBe(0);
        resolve();
      }, 30);
    });
  });

  test('removes event listeners on close', () => {
    const scope = createResourceScope();
    const target = new EventTarget();
    let count = 0;
    const handler = () => count++;
    scope.eventListener(target, 'click', handler);
    target.dispatchEvent(new Event('click'));
    expect(count).toBe(1);
    scope.close();
    target.dispatchEvent(new Event('click'));
    expect(count).toBe(1);
  });

  test('unsubscribes store subscriptions on close', () => {
    const scope = createResourceScope();
    let unsubbed = false;
    scope.storeSub(() => {
      unsubbed = true;
    });
    scope.close();
    expect(unsubbed).toBe(true);
  });

  test('terminates workers on close', () => {
    const scope = createResourceScope();
    const worker = {
      terminate: () => undefined,
    } as unknown as Worker;
    let terminated = false;
    worker.terminate = () => {
      terminated = true;
    };
    scope.worker(worker);
    scope.close();
    expect(terminated).toBe(true);
  });

  test('removes abort listeners on close', () => {
    const scope = createResourceScope();
    const controller = new AbortController();
    let aborted = false;
    scope.abortListener(controller.signal, () => {
      aborted = true;
    });
    scope.close();
    controller.abort();
    expect(aborted).toBe(false);
  });

  test('add after close runs immediately', () => {
    const scope = createResourceScope();
    scope.close();
    let ran = false;
    scope.add(() => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  test('isClosed reflects state', () => {
    const scope = createResourceScope();
    expect(scope.isClosed()).toBe(false);
    scope.close();
    expect(scope.isClosed()).toBe(true);
  });

  test('throws when adding timer after close', () => {
    const scope = createResourceScope();
    scope.close();
    expect(() => scope.timer(() => undefined, 10)).toThrow('already closed');
  });
});
