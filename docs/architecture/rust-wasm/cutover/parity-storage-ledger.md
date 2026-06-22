# Storage Parity Ledger

## Purpose

This file owns storage parity rows.

## Details

| Storage family      | Rust status | Required Rust modules             | Proof before cutover                                                                                                                                        |
| ------------------- | ----------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protected records   | partial     | `storage`, `web`, `app`, `ui`     | SQLite startup, workspace, settings, accounts, active selector proof, relay sets, drafts, worker tests                                                      |
| Event cache         | partial     | `storage`, `web`, `app`, `relays` | Rust event/tag/provenance row tests pass; validation, query breadth, retention, and feed proof remain                                                       |
| Feed evidence       | partial     | `storage`, `app`, `relays`        | Rust coverage/cursor row tests pass; complete route-group proof and compaction invalidation remain                                                          |
| Diagnostics and log | partial     | `storage`, `web`, `app`, `ui`     | Storage inventory, SQLite health, pressure rows, readiness classification, and command metadata have proof; relay, jobs, memory, and full log parity remain |
| Relay optimizer     | partial     | `relays`, `app`, `storage`, `web` | score, scan hint, route trust, host-runner, Stats, and synthetic relay tests                                                                                |
