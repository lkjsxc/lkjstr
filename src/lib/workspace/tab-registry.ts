import type { TabKind } from './tab';
import { createBasicRuntime, type TabRuntime } from './tab-runtime';
import { titleFor } from './workspace';

export type TabRuntimeArgs<TConfig> = {
  readonly tabId: string;
  readonly config: TConfig;
};

export type TabDefinition<TConfig, TState> = {
  readonly kind: TabKind;
  readonly title: (config: TConfig) => string;
  readonly icon: (config: TConfig) => string;
  readonly createDefaultConfig: () => TConfig;
  readonly createRuntime: (args: TabRuntimeArgs<TConfig>) => TabRuntime<TState>;
  readonly serializeState: (state: TState) => unknown;
  readonly restoreState: (raw: unknown) => TState;
};

export class TabRegistry {
  #definitions = new Map<TabKind, TabDefinition<unknown, unknown>>();

  register<TConfig, TState>(definition: TabDefinition<TConfig, TState>): void {
    this.#definitions.set(
      definition.kind,
      definition as TabDefinition<unknown, unknown>,
    );
  }

  get(kind: TabKind): TabDefinition<unknown, unknown> | undefined {
    return this.#definitions.get(kind);
  }

  require(kind: TabKind): TabDefinition<unknown, unknown> {
    const definition = this.get(kind);
    if (!definition) throw new Error(`Unknown tab kind: ${kind}`);
    return definition;
  }
}

export function createDefaultTabRegistry(): TabRegistry {
  const registry = new TabRegistry();
  const kinds: TabKind[] = [
    'timeline',
    'notifications',
    'profile',
    'account-manager',
    'post-manager',
    'thread',
    'relay-monitor',
    'composer',
    'settings',
    'cache-status',
  ];
  for (const kind of kinds) registry.register(defaultDefinition(kind));
  return registry;
}

function defaultDefinition(
  kind: TabKind,
): TabDefinition<Record<string, unknown>, object> {
  return {
    kind,
    title: () => titleFor(kind),
    icon: () => kind,
    createDefaultConfig: () => ({}),
    createRuntime: ({ tabId }) =>
      createBasicRuntime(tabId, {}, { title: titleFor(kind), icon: kind }),
    serializeState: (state) => state,
    restoreState: () => ({}),
  };
}
