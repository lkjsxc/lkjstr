# Host source

## Purpose

Implement the native static-asset server without browser or account ownership.

## Table of Contents

- [assets.rs](assets.rs): bounded validation of the immutable deployment tree.
- [lib.rs](lib.rs): HTTP routing, file service and response policy.
- [main.rs](main.rs): check, serve, probe and graceful shutdown commands.
