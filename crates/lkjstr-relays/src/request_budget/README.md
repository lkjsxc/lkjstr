# Request Budget Source

## Purpose

Request-budget source files derive bounded relay `REQ` policy from runtime
intent and typed relay limits.

## Table of Contents

- `apply.rs`: filter clamping and read-cap merge helpers.
- `derive.rs`: request-budget derivation from app and relay limits.
- `mod.rs`: module exports.
- `policy.rs`: local app caps and intended limit policy.
- `types.rs`: request-budget inputs, outputs, limits, and warnings.
