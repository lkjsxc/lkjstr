# Xtask Source

## Purpose

Xtask source files implement repository checks and command orchestration.

## Table of Contents

- [browser_driver.rs](browser_driver.rs): browser-driver selection for WASM checks.
- [command.rs](command.rs): quiet command matrix runner.
- [doc_check.rs](doc_check.rs): documentation shape and topology checks.
- [doc_shape.rs](doc_shape.rs): required headings for task and skill docs.
- [line_check.rs](line_check.rs): documentation and source line caps.
- [main.rs](main.rs): xtask command dispatch.
- [paths.rs](paths.rs): repository traversal helpers.
- [quiet_steps.rs](quiet_steps.rs): quiet verification step definitions.
- [rust_style.rs](rust_style.rs): Rust production style scan.
- [sqlite_schema_doc.rs](sqlite_schema_doc.rs): SQLite schema documentation check.
- [storage_manifest.rs](storage_manifest.rs): storage manifest docs check.
- [tool_path.rs](tool_path.rs): Rust toolchain path preference helpers.
- [toolchain.rs](toolchain.rs): required Rust/WASM tool preflight diagnostics.
