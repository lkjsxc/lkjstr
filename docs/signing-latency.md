# Public signing latency

## Purpose

Measure signing for a post or reaction through the released WASM Worker.
Release builds retain the current Worker's 32 most recent public signing
requests and 32 requests that took more than 300 ms from enqueue to terminal
result. The Stats action can read these rings. Each trace has at most 128
pending entries and 256 recent activity spans, all held in memory. A stopped or
restarted Worker drops both rings. Completed rows carry no request tokens,
credentials, account or event identifiers, relay addresses, or event bodies.

## Timing stages

- Page intent starts at the Post or reaction click. A like has an intentional
  eight-second Undo hold. Dispatch starts after that hold or the supported flush.
- Enqueue starts at the transport boundary. Page and Worker use performance
  clocks translated by their time origins. Direct callers without a transport
  stamp start at Worker receipt.
- Receipt marks action arrival at the Worker. Start marks the engine's sign
  request reaching its signer. Response marks a returned local signature or
  external signer reply. Signed marks the engine's verification of the event.
- Published marks the first accepted relay OK, or the verified delivery result
  for acceptance by echo. Finished marks the terminal
  result, including failures. The loopback probe also measures the first EVENT
  frame and the fixture's OK independently of the Worker's scheduling.
- Boot, restart and hidden flags describe the action at enqueue. Cache and account
  flags at receipt describe in-flight operations. Coarse spans time ingest
  and decode, verification, planning, rendering, wire output, cache work,
  IndexedDB waits, account/private sync, boot and key operations. The last
  unlock's derivation and key validation also have a separate timing. Spans report total overlap
  and overlap before receipt. The rolling history can omit old activity on a
  long wait.

NIP-49 accounts retain a validated, serde-skipped key after explicit unlock.
Password derivation is a separate operation before signing. Lock, removal,
signer replacement and restart keep their existing authority boundaries.
