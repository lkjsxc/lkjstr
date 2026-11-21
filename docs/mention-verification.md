# Mention verification

## Purpose

The public composer passes selected UTF-16 ranges through `Draft.mentions`.
Post, inline Reply and Quote use the same publish action. A bare @ requests
local context through `people`; prefix search and explicit person lookups
retain their existing paths. [Owner wishes](wishes.md) describes the contract.

`pnpm engine:check` runs the mention witness on an isolated Worker, signed
fixture events and a loopback WebSocket relay. It checks the verified follow
list and conversation candidates, including their profile metadata. The three
draft shapes compare
the complete signed event received by the relay with the disposable signer's
event and match the Worker result to the relay OK by event ID. The witness
checks exact content and exact p, e and q tag arrays. It repeats a selected
recipient, overlaps a selected recipient with the target author, preserves
inherited reply participants and checks that plain @ text adds no recipient. A separate pasted-address draft
checks preserved nprofile relay hints, unchanged URL and malformed text, and
exact profile projection.
A second Worker with new browser storage reads the same events from the relay
and checks the projected mention identities. The real UI smoke covers the
composer interaction and the rendered link.

For a focused run with a built Worker and fixture signer, run
`node scripts/engine-mentions.mjs`. Use `LKJSTR_ENGINE_PKG` to select
the Worker package and `LKJSTR_ENGINE_REPORT` for the receipt JSON directory.
