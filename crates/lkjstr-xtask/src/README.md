# Xtask source

## Purpose

Repository validation and quiet verification for the frontend/Worker product.

## Table of Contents

- command.rs: quiet gate matrix.
- dist_check.rs: public pages and static assets; dist_graph.rs follows generated
  literal import and Worker/loader URL forms from index.html to WASM.
- dist_refs.rs: the generated reference scanner, not a general JavaScript parser.
  The graph is capped at 1024 assets and every path must stay inside dist.
- doc_check.rs: documentation topology and shape.
- line_check.rs: documentation/source caps.
- main.rs: command dispatch.
- paths.rs: bounded repository traversal exclusions.
- quiet_process.rs: command output and timeout handling.
- quiet_steps.rs: Rust and real frontend/Worker build steps.
- rust_style.rs and rust_style_test.rs: production Rust rules and regressions.
- tool_path.rs: installed Rust tool selection.
