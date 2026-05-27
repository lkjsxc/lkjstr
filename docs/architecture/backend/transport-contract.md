# Transport Contract

## Purpose

Define the local transport used by browser backend services.

## Contract

- Tabs call local TypeScript APIs directly. No placeholder remote transport or
  remote cache adapter is part of the contract.
- Backend services use the existing subscription orchestrator and relay pool for
  network work.
- Snapshot delivery is local subscription callback delivery. Actions such as
  paging, refresh, visibility, retry, and close are direct method calls.
- Future remote transport work must preserve the same action and snapshot
  semantics before replacing the local boundary.
