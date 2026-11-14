# Verification

## Purpose

The gates, how to run them on a shared host, and what was actually checked.

## Quiet gates

Each prints one `ok <name>` line on success and a bounded tail on failure.

| Command | Runs |
| --- | --- |
| `pnpm check:repo` | doc shape, line limits, Rust style rules |
| `pnpm test:quiet` | fmt, clippy (native and wasm32), `cargo test --workspace` |
| `pnpm rust-wasm:quiet` | the above plus `trunk build --release` and `check-dist` |
| `pnpm verify:quiet` | repo checks plus everything in `rust-wasm` |

On shared hosts cap jobs with `CARGO_BUILD_JOBS=4`.

## Docker (final gate)

```sh
docker compose --progress quiet -f docker-compose.yml build verify
docker compose --progress quiet -f docker-compose.yml run --rm verify
```

The `app` target serves the release build on `127.0.0.1:8418` for previews.

## Browser checks

`pnpm smoke:browser [out-dir]` serves `dist/` on a free port and drives
Chromium (Playwright) with every WebSocket routed to an in-process fake relay,
so nothing is published to public relays. It creates a local key, posts,
opens the thread, replies, likes, splits and moves focus by keyboard, reloads
(layout, account and cached notes must persist), checks Notifications settles,
and checks the single-tile narrow mode. It prints JSON and exits non-zero on
any failed check. Set `LKJSTR_CHROME` to choose the browser binary.

Browser checks are evidence, not a canonical gate: Chromium must be present.

## Record

2026-11-14, revive branch:

- Global from public relays in Chromium: five relays connected, verified
  events rendered, Relays view showed state, latency and counts.
- `pnpm smoke:browser` against a debug build: all 14 checks passed. It found
  and now guards a want-id collision that left Notifications unplanned.
