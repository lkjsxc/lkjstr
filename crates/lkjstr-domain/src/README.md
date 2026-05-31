# Domain Source

## Purpose

Domain source files define pure reducers and shared browser-independent models.

## Table of Contents

- `accounts.rs`: account records, signer capabilities, and pubkey parsing.
- `lib.rs`: public domain exports.
- `local_account.rs`: local secret records, nsec parsing, and signing.
- `npub_miner.rs`: npub prefix parsing and search-size helpers.
- `relay_sets/`: pure relay-set records and edit reducers.
- `upload_settings/`: pure media upload provider resolution.
- `workspace/`: pure workspace layout, tab, and recovery model.
