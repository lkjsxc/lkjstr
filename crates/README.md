# Crates

## Purpose

Rust crates of lkjstr. The root Cargo.toml is a virtual workspace; web/ owns
the only interface. The Worker has no DOM or UI framework dependency.

## Table of Contents

- [lkjstr-nips/](lkjstr-nips/): independent Nostr codecs, cryptography, and policy.
- [lkjstr-protocol/](lkjstr-protocol/): Nostr protocol kernel.
- [lkjstr-core/](lkjstr-core/): layout, workspace, store, planner, scoring, timelines.
- [lkjstr-engine-worker/](lkjstr-engine-worker/): browser Worker and effects.
- [lkjstr-host/](lkjstr-host/): experimental native static server; product preview uses web/scripts/.
- [lkjstr-xtask/](lkjstr-xtask/): repository checks and quiet gates.
