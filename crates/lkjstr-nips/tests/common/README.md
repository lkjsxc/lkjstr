# Protocol Test Helpers

## Purpose

Deterministic test-only keys, event builders, and independent wire encoders.
No real signing secrets, endpoints, or payment operations belong here.

## Table of Contents

- `mod.rs`: public test keys, events, tags, hexadecimal, and Bech32 encoding.
- `invoices.rs`: direct BOLT11 preimage signing, route hints, and zap fixtures.
