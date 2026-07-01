# Focused Gates

## Purpose

Focused gates map common change areas to small checks beyond the normal quiet
and Docker verification path. Detailed commands live in
[focused-gates/README.md](focused-gates/README.md).

## Gate Map

- [focused-gates/feed.md](focused-gates/feed.md): feed regression and user-requested reliability checks.
- [focused-gates/post-display.md](focused-gates/post-display.md): read availability and real-post display checks.
- [focused-gates/relay.md](focused-gates/relay.md): relay paging, hardening, orchestration, and Rust relay host checks.
- [focused-gates/storage.md](focused-gates/storage.md): storage and cache checks.
- [focused-gates/memory.md](focused-gates/memory.md): memory and background work checks.
- [focused-gates/ui.md](focused-gates/ui.md): root response and Docker smoke checks.
- [focused-gates/rust-cutover.md](focused-gates/rust-cutover.md): Rust/WASM task-id gates.

## Rule

Run the focused gate for the changed area before the repository quiet gates.
While the temporary e2e suspension is active, omit Playwright, browser workflow,
and `wasm-pack test --headless` focused steps unless the user asks for a manual
diagnostic run. Run the Docker final gate from [verification.md](verification.md)
before claiming broad repository verification or product cutover readiness.
