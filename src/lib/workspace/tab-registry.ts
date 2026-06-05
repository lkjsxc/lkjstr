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

export type TabRegistry = ReturnType<typeof createTabRegistry>;

export function createTabRegistry() {
  const definitions = new Map<TabKind, TabDefinition<unknown, unknown>>();
  return {
    register: <TConfig, TState>(
      definition: TabDefinition<TConfig, TState>,
    ): void => {
      definitions.set(
        definition.kind,
        definition as TabDefinition<unknown, unknown>,
      );
    },
    get: (kind: TabKind): TabDefinition<unknown, unknown> | undefined =>
      definitions.get(kind),
    require: (kind: TabKind): TabDefinition<unknown, unknown> => {
      const definition = definitions.get(kind);
      if (!definition) throw new Error(`Unknown tab kind: ${kind}`);
      return definition;
    },
  };
}

export function createDefaultTabRegistry(): TabRegistry {
  const registry = createTabRegistry();
  const kinds: TabKind[] = [
    'welcome',
    'new-tab',
    'timeline',
    'global',
    'public-chat',
    'notifications',
    'profile',
    'profile-edit',
    'upload-settings',
    'account-manager',
    'npub-miner',
    'thread',
    'relay-monitor',
    'relay-settings',
    'network-stats',
    'search',
    'custom-request',
    'tweet',
    'settings',
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
