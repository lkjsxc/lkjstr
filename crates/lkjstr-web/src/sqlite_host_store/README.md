# SQLite Host Store

## Purpose

This directory owns the page-local Rust/WASM host registry for SQLite worker
stores. The registry borrows the JavaScript app broker for the product database
instead of constructing a persistent worker or acquiring a Web Lock itself. It
is the explicit exception to the general no-global-state style guard because the
storage contract requires one shared product database owner per page, worker
URL, and database name.

## Table of Contents

- [registry.rs](registry.rs): keyed store registry, open coalescing, and
  controlled close-all for reset or tests.
