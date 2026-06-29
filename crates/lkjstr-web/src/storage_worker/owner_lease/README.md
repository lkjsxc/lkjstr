# Storage Worker Owner Lease

## Purpose

This submodule holds the wasm32 Web Locks reflection code for the SQLite OPFS
owner lease. It avoids `wasm_bindgen(inline_js)` so production storage ownership
cannot depend on untracked snippet assets.

## Table of Contents

- `web_lock.rs`: Web Locks acquisition, busy mapping, and deterministic release.
