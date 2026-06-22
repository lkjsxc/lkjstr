# Operations

## Purpose

Operations docs define quiet verification, Docker, CI, Cloudflare, data safety,
readiness, diagnostics, and focused gates.

## Table of Contents

- [verification.md](verification.md): canonical local, Rust/WASM, Cloudflare,
  and Docker gates.
- [focused-gates.md](focused-gates.md): narrow checks by change area.
- [testing-ownership.md](testing-ownership.md): unit, repository,
  host-boundary, smoke, and manual ownership.
- [docker.md](docker.md): Compose image targets and guardrails.
- [ci.md](ci.md): CI jobs and Compose commands.
- [cloudflare-workers.md](cloudflare-workers.md): Workers Static Assets target.
- [memory-verification.md](memory-verification.md): cleanup counters and manual
  heap diagnostics.
- [storage-pressure-verification.md](storage-pressure-verification.md): storage
  budget and compaction acceptance.
- [sqlite-opfs-testing.md](sqlite-opfs-testing.md): SQLite worker host checks.
- [data-safety.md](data-safety.md): protected data and export safety.
- [diagnostics.md](diagnostics.md): lkjstr Log and runtime diagnostics.
- [readiness.md](readiness.md): final readiness checklist.
- [feed-route-isolation-regression.md](feed-route-isolation-regression.md): feed
  route isolation investigation.
- [timeline-notification-regression-investigation.md](timeline-notification-regression-investigation.md):
  notification and timeline investigation notes.

## Rule

Run the focused gate for the area you changed, then the Docker final gate from
[verification.md](verification.md) before claiming the repository is verified.

## All Files

```text
`ci.md` `cloudflare-workers.md` `data-safety.md` `diagnostics.md` `docker.md` `feed-route-isolation-regression.md` `focused-gates.md`
`memory-verification.md` `readiness.md` `sqlite-opfs-testing.md` `storage-pressure-verification.md` `testing-ownership.md` `timeline-notification-regression-investigation.md` `verification/README.md`
`verification/acceptance-checks.md` `verification/docker-final-gate.md` `verification/quiet-contract.md` `verification/rust-wasm.md` `verification/sqlite-opfs.md` `verification.md`
```
