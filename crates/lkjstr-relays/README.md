# lkjstr Relays

## Purpose

This crate owns pure relay runtime state machines. Browser WebSocket and timer
handles live in `lkjstr-web`; this crate emits effect commands for those host
adapters to execute.

## Table of Contents

- [src/](src/): relay state machine source.
- [tests/](tests/): relay state machine tests.
