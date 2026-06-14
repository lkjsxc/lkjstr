# Author Context

## Purpose

Author Context retained helpers load nearby real events from one author around an
anchor event while deletion proof remains open.

## Table of Contents

- [Contract](#contract)

## Contract

- The anchor event is loaded from cache or selected relays.
- Cached and relay results are merged and deduplicated.
- Metadata and follow-list events never appear in the rendered result list.
- The shipped tab now mounts a Rust/WASM island; these helpers stay only until
  no-import proof and final deletion gates pass.
