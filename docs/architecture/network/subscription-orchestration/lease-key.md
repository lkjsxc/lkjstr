# Lease Key

## Purpose

Define how compatible live Demands merge into one shared lease.

Status: Rust owns canonical fingerprint and lease key derivation for pure
Demand records. TypeScript still owns browser subscription side effects.

## Wire-equivalent rule

Lease identity is derived from the **normalized wire request**, not from the
pre-normalization Demand shape.

Steps:

1. Build Demand from intent and route plan.
2. Apply live filter normalization (`since` injection, clear `limit` for live).
3. Fingerprint relays + normalized filters + phase + purpose + channel.
4. Map fingerprint to wire key `lease:<hash>`.

Two Demands that differ only in redundant filter `since` before normalization
but produce the same wire REQ must share one fingerprint.

## Exclusions

Lease fingerprints must not include:

- `owner`
- surface identity
- tab id
- runtime `subId`
- pane id

Surface identity stays in demand owners, ingress classification, cache proof,
and view-model state. Two surfaces that produce the same relay request may share
one live wire lease, but each surface still interprets the incoming events
through its own reducer and completeness rules.

## Home session anchor

Home live `since` uses a session anchor keyed by account plus normalized selected
relays. Multiple Home tabs for the same account and relay set share one anchor
so live leases remain stable across tabs.

## Related

- [live-lease.md](live-lease.md)
- [compatibility.md](compatibility.md)
- `crates/lkjstr-relays/src/demand/`
- `src/lib/relays/orchestration/lease-key.ts`
