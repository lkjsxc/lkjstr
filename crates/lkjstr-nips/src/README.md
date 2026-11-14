# Nostr Protocol Implementation

## Purpose

Pure protocol codecs, cryptography, and client policy. Hosts supply effects,
randomness, timestamps, and trust inputs. See the [crate API map](../README.md).

## Table of Contents

- Public modules are exported by `lib.rs` and documented in Rust API comments.
- `bech32_checksum.rs` retains the original checksum with explicit length limits.
- `invoice_wire.rs` and `tlv.rs` hold private wire-format helpers.
