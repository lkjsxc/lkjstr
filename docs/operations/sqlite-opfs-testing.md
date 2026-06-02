# SQLite OPFS Testing

## Purpose

This file defines the required verification for the worker-owned SQLite storage
cutover.

## Browser Worker Tests

Required worker tests:

- Open official SQLite WASM in persistent OPFS mode when the browser supports it.
- Open official SQLite WASM in forced temporary memory mode.
- Apply schema changes once and confirm reopening does not duplicate schema
  bookkeeping.
- Insert an event batch twice and confirm idempotent event, tag, and relay
  receipt rows.
- Cancel a long request and receive `cancelled` without delivering late rows to
  product logic.
- Map busy or locked errors into recoverable storage outcomes.

## Persistence Tests

Required Playwright scenarios:

- Empty origin startup reaches Welcome and reports storage health.
- Settings survive reload in persistent OPFS mode.
- Workspace layout and tab snapshots survive reload.
- Tweet draft text survives reload and clears after local signing plus queueing.
- Cached events, tags, relay receipts, and feed coverage survive reload.
- Local cache renders before fresh relay reads when complete coverage exists.

## Multi Tab Tests

Required scenarios:

- Two tabs share one storage owner when SharedWorker is available.
- Dedicated-worker fallback refuses an unsafe second writer or reports busy.
- Closing the owning tab releases worker callbacks and pending requests.
- A later tab recovers storage ownership without stale UI promises resolving.

## Temporary Mode Tests

Required scenarios:

- Forced memory mode shows the temporary-storage banner.
- Writes work during the session.
- Reload does not claim those writes are durable.
- Stats reports `temporary-memory` and a warning.

## Corruption And Reset Tests

Required scenarios:

- Integrity check failure shows a storage error state.
- Reset requires confirmation.
- Reset clears database-owned rows and returns to Welcome.
- Diagnostics never log private keys, PRF outputs, AES keys, or decrypted direct
  message content.

## Docker Gate

The final gate is Docker Compose from built images:

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify e2e cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm e2e
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```
