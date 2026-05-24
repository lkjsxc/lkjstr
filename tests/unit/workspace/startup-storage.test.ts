import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapWorkspace } from '../../../src/lib/workspace/workspace-bootstrap';

const localStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
);
const indexedDbDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'indexedDB',
);

describe('startup workspace storage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.unstubAllGlobals();
    restoreGlobal('localStorage', localStorageDescriptor);
    restoreGlobal('indexedDB', indexedDbDescriptor);
  });

  it('creates a deterministic split bootstrap workspace', () => {
    expect(bootstrapWorkspace()).toEqual(bootstrapWorkspace());
    const workspace = bootstrapWorkspace();
    expect(workspace.id).toBe('main');
    expect(workspace.tabs[workspace.focusedTabId!]?.title).toBe('Accounts');
    expect(workspace.layout?.type).toBe('split');
  });

  it('loads and saves through memory when localStorage throws', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('denied');
      },
    });
    const { loadWorkspace, saveWorkspace } =
      await import('../../../src/lib/workspace/workspace-persistence');
    const loaded = await loadWorkspace();
    await saveWorkspace({ ...loaded, name: 'Memory workspace' });
    expect((await loadWorkspace()).name).toBe('Memory workspace');
  });

  it('falls back when IndexedDB reads and writes time out', async () => {
    vi.stubGlobal('indexedDB', { open: () => ({}) });
    vi.doMock('../../../src/lib/storage/browser-db', () => ({
      browserDb: () => ({
        workspaces: {
          get: () => new Promise(() => undefined),
          put: () => new Promise(() => undefined),
        },
      }),
    }));
    vi.useFakeTimers();
    const { loadWorkspace } =
      await import('../../../src/lib/workspace/workspace-persistence');
    const loaded = loadWorkspace();
    await vi.advanceTimersByTimeAsync(400);
    expect(await loaded).toMatchObject({ id: 'main', name: 'Main workspace' });
  });

  it('ignores oversized local workspace snapshots before parsing', async () => {
    const parse = vi.spyOn(JSON, 'parse');
    vi.stubGlobal('localStorage', {
      getItem: () => '{'.repeat(250_000),
      setItem: () => undefined,
    });
    const { loadWorkspace } =
      await import('../../../src/lib/workspace/workspace-persistence');
    const loaded = await loadWorkspace();
    expect(loaded.id).toBe('main');
    expect(parse).not.toHaveBeenCalledWith('{'.repeat(250_000));
    parse.mockRestore();
  });
});

function restoreGlobal(
  name: 'localStorage' | 'indexedDB',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}
