# Quiet Contract

## Purpose

Quiet commands, local gates, and duplicate-work rules.

## Details

Quiet commands are canonical for LLM-agent and CI runs.

A passing quiet command prints only one final success line:

- `ok test`
- `ok verify`
- `ok ci`
- `ok cloudflare`
- `ok rust-wasm`

Quiet commands capture child stdout and stderr in memory. They print captured
output only when the child exits with a nonzero status, is terminated by a
signal, or fails to spawn.
`lkjstr-xtask` quiet child steps are also bounded by a 30-minute step timeout;
timed-out steps fail the quiet command and print the captured output tail.

Quiet commands must not hide diagnostics. On failure they print the step name,
exit status or signal, and the captured output tail with a bounded byte budget.

Normal verbose commands remain available for local debugging:

- `pnpm test`
- `pnpm verify`
- `pnpm cloudflare:dry-run`

CI must use quiet commands by default. Host-boundary Rust/WASM tests may use
headless browsers when Node cannot represent the platform API, but they do not
exercise tiled workspace browser flows.


## Local Canonical Gate

Run documentation and repository checks before implementation continues after a
contract change:

```sh
pnpm check:repo
```

Run focused and quiet local gates:

```sh
pnpm test:quiet
pnpm rust-wasm:quiet
pnpm verify:quiet
pnpm cloudflare:quiet
```

`pnpm verify:quiet` runs repository checks, lint, typecheck, unit tests, and a
production build. `pnpm ci:quiet` is an orchestration alias only when it does
not repeat the same child plan. Cloudflare stays separate so adapter and
Wrangler failures remain easy to isolate.


## No Duplicate Work

- CI must not run full host verification and then repeat the same full
  verification inside Docker on the default pull request path.
- CI must not build the production app repeatedly unless a target needs a
  distinct artifact.
- Docker Cloudflare dry-run consumes the already-built app artifact from the
  `app-build` target.
- Publish must reuse the checked app image or the same Docker cache and target.
- Quiet command ownership must avoid `xtask -> pnpm -> xtask` and
  `pnpm -> xtask -> pnpm verify:quiet` recursion.
