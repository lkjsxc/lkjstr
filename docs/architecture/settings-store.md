Owner: Architecture
State: Canon

# Settings Store

## Role

The settings store owns the schema, user overrides, search records, validation,
and persistence for the settings tab.

## Data Flow

- Schema records define key, namespace, label, description, type, default,
  reload flag, and sensitivity.
- User overrides store only values that differ from defaults.
- Effective records merge schema defaults with overrides.
- Search indexes namespace, key, label, description, type, default, and value.
- Import validates every key before writing any accepted override.

## Persistence

Settings persist in IndexedDB and a local snapshot fallback. Settings must load
before workspace render can apply theme tokens, but a settings load failure must
fall back to defaults.
