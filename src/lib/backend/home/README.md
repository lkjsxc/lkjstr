# Home Backend

Shared Home queries are keyed by account, selected relays, page size, and feed
policy. Tab ids are attachment owners, not query keys.

## Table of Contents

- [home-query.ts](home-query.ts)
- [home-query-key.ts](home-query-key.ts)
- [home-query-registry.ts](home-query-registry.ts)

## Map

- [home-query.ts](home-query.ts): public attach API.
- [home-query-key.ts](home-query-key.ts): canonical query key.
- [home-query-registry.ts](home-query-registry.ts): refcounted runtime owner.
