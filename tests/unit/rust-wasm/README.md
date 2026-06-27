# Rust WASM Unit Tests

## Purpose

Focused TypeScript tests for Rust/WASM bridge loading, toolchain preflight, and
product bridge-unavailable presenters.

## Table of Contents

- [build-lkjstr-web-wasm.test.ts](build-lkjstr-web-wasm.test.ts): strict artifact manifest helpers.
- [wasm-toolchain.test.ts](wasm-toolchain.test.ts): wasm-pack preflight text.
- [bridge-unavailable.test.ts](bridge-unavailable.test.ts): product-safe bridge errors.
- [verify-built-wasm-assets.test.ts](verify-built-wasm-assets.test.ts): source and Cloudflare bridge asset verifier.
- [vite-wasm-plugin.test.ts](vite-wasm-plugin.test.ts): asset-only Vite bridge plugin.
