# lkjstr UI

## Purpose

This crate owns Leptos components and CSS-class rendering contracts.

## Table of Contents

- [src/](src/): Leptos UI source.
- [tests/](tests/): focused UI provider and rendering tests.

## Ownership Index

- Owned meaning: Rust workspace shell, real product view rendering, Stats,
  Settings, Accounts, Relay Settings, Upload Settings, lkjstr Log, Tweet draft
  surfaces, and future feed row components.
- Forbidden meaning: fake data, placeholder success UI, protocol parsing,
  storage statements, relay sockets, and browser storage effects.
- Effect boundary: renders Rust view models and emits user intents; host effects
  stay in `lkjstr-web`.
- Main tests: `cargo test -p lkjstr-ui`.
- Next cutover task: render Rust feed view-model rows for the first Home slice.
