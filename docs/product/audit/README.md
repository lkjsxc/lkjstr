# Product Audit Detail

## Purpose

This subtree makes the documentation implementation audit executable for LLM
agents. It lists the next source paths, proof files, and closing gates for rows
that remain partial or not implemented in the concise audit.

## Table of Contents

- [rust-wasm-target.md](rust-wasm-target.md): Rust/WASM partial ownership rows.
- [product-polish.md](product-polish.md): visible product polish rows from the
  backlog.
- [verification-gaps.md](verification-gaps.md): gates that close audit rows.

## Edit Rules

- Keep the concise matrix in [../doc-impl-audit.md](../doc-impl-audit.md)
  readable; put path-heavy detail here.
- Update this subtree before changing a partial implementation slice.
- Move a row to implemented only after the named source path and gate prove it.
- Use real source paths and real checks. Do not list placeholder owners.
