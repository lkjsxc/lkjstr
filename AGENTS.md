# Agent Instructions

## Purpose

This file is the entry point for automated coding agents. It states what
lkjstr is, the non-negotiable rules, the read order, task routing, and where
deeper contracts live. The agent operating manual is
[docs/agent/README.md](docs/agent/README.md).

## What lkjstr Is

lkjstr is a browser-first, local-first Nostr workspace. The root route opens
a tiled app for reading timelines, composing notes, inspecting relays,
managing signing accounts, and following event threads. There is no
server-side account system, relay proxy, custody service, or backend.

## Runtime Ownership

- Shipped product runtime: SvelteKit and TypeScript under `src/`.
- Target runtime: Rust/WASM crates under `crates/` with Leptos UI, cut over
  slice by slice with parity and deletion proof.
- Durable storage: worker-owned SQLite OPFS. Main-thread code never opens
  SQLite or OPFS directly; product modules call typed repositories only.
- Path detail: [docs/architecture/source-map.md](docs/architecture/source-map.md).

## Non-Negotiables

- No fake product data and no placeholder success states. The canonical rule
  is [docs/agent/no-fake-data.md](docs/agent/no-fake-data.md).
- Do not delete TypeScript or Svelte product code without real Rust parity,
  focused tests, ledger evidence, and no-import proof; follow
  [docs/agent/skills/deletion-proof.md](docs/agent/skills/deletion-proof.md).
- Never log, export, or expose local signing secrets except by explicit user
  action and documented product behavior.
- Unsupported browser security features show explicit unsupported states and
  never degrade silently.
- Keep docs and implementation aligned in the same change, including
  [docs/current-state.md](docs/current-state.md) when shipped behavior moves.
- Keep source files at or below 200 lines and docs at or below 200 lines.
- Use factory functions and plain data, not first-party classes, in `src`;
  see [docs/repository/functional-style.md](docs/repository/functional-style.md).
- Relay, diagnostic, and tab runtime memory stays bounded with explicit close
  and destroy paths.
- Docker checks build images and never mount the source tree. Browser
  workflow suites are not canonical verification gates.

## Read Order

1. [docs/current-state.md](docs/current-state.md): implemented truth.
2. [docs/agent/README.md](docs/agent/README.md): work loop, skills, handoff.
3. [docs/execution/current-blockers.md](docs/execution/current-blockers.md):
   the dependency-ordered queue.
4. The contracts linked from the chosen blocker, task, or skill.

[docs/README.md](docs/README.md) is the full docs index when the read order
above does not answer the question.

## Task Routing

- When the user names a task, do it and load the matching skill from
  [docs/agent/skills/README.md](docs/agent/skills/README.md).
- Otherwise take the first incomplete blocker in
  [docs/execution/current-blockers.md](docs/execution/current-blockers.md).
- Follow [docs/agent/work-loop.md](docs/agent/work-loop.md) for the change
  loop: docs first, narrowest source change, focused tests, ledgers, gates.

## Verification

- Quiet commands are canonical and print one `ok ...` line on pass:
  `pnpm check:repo`, `pnpm test:quiet`, `pnpm rust-wasm:quiet`,
  `pnpm verify:quiet`, `pnpm cloudflare:quiet`.
- Run the focused gate named by the skill or task file before quiet gates;
  area gates live in
  [docs/operations/focused-gates.md](docs/operations/focused-gates.md).
- Docker Compose is the authoritative final gate; the exact commands live in
  [docs/operations/verification.md](docs/operations/verification.md).

## Handoff

Follow [docs/agent/handoff.md](docs/agent/handoff.md). Commit messages follow
[docs/repository/commit-protocol.md](docs/repository/commit-protocol.md);
`Tested:` and `Not-tested:` must match actual verification.
