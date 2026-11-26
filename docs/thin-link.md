# Thin-link scheduling and startup

## Purpose

Keep verified notes and names usable when transport capacity is small or interrupted.
The browser remains a local-first client. No proxy, visible setting or account rule
is introduced; signature verification, NIP revision order and history coverage remain.

## Startup

Worker loaders emit bounded bootstrap heartbeats while fetching and compiling WASM.
Only actual engine readiness starts ordinary operations. At most 32 pending ports
are retained, and both success and failure release the bootstrap timer. A
15-minute total boot bound closes stalled loaders; late initialization cannot
start a runtime after that bound.

First offline-shell installation waits for engine readiness. Content-addressed
assets reuse HTTP cache bytes and still require the exact build manifest SHA-256.
A cache mismatch permits one fresh reload, which must pass the same verification.
Mutable assets retain fresh fetches. A progressing transfer may exceed one minute;
60-second inactivity and 15-minute transfer/install limits bound stalled work.
An already-controlled page still checks for an update before engine readiness.
First-install failures retry with bounded exponential delay through 30 seconds;
online and visible resumption recover without a reload. Successful registration
counts as the script check, avoiding an immediate second update fetch.

## Read planning

The existing browser effectiveType field supplies an advisory prior in Rust:

| Hint | Bytes per second | RTT prior |
| --- | ---: | ---: |
| slow-2g or 2g | 6250 | 1500 ms |
| 3g | 75000 | 500 ms |
| absent, unknown or 4g | Existing unsampled default | Existing default |

Hints never count as measured throughput, verification, freshness or absence.
Resident and durable retention costs use observation-only link state.
Four qualifying traffic observations replace the throughput prior. Sparse traffic
without a qualifying backlog does not independently establish link capacity.
Very thin public note head requests start with eight records; other adaptive
heads retain their minimum of 20. Historical continuations retain their existing
quotas so inclusive timestamp ties preserve the prior progress bound. Asked quotas
stay fixed, including a later hint change. Explicit IDs, metadata, verification
retries and time-window work retain their existing quotas and bounded author buckets.

Two ordinary complete-filter primary routes remain. At the 2g prior the no-data
hedge waits three seconds. Learned thin hedges cap at four seconds and soft
first-event demotion waits 4.5-5 seconds, so it cannot precede the hedge. Public
request deadlines remain five seconds. Thin links disable speculative older-page
prefetch; required cache repair, account data and signed deletion work remain.

Transport backoff resets only after a matching verified delivery on a connection
healthy for at least ten seconds. Handshakes alone cannot reset repeated failures,
and explicit rate-limit cooldown is preserved. Hiding or closing views retains
the existing owner release and late-response fences.

## Qualification scope

The private production-Worker harness compares the frozen 6312b9fc package with
the candidate using identical signed notes, metadata pressure and visible-row
oracles. It distinguishes cold assets/events from committed IndexedDB and an
installed offline shell. DOM/requestAnimationFrame timings measure readiness,
not compositor-confirmed pixel presentation. Network accounting separates encoded
HTTP transfer and WebSocket application payload from lower-level TCP/TLS overhead.

A known-size concurrent page/Worker HTTP and relay control checks the common byte
budget. Chromium provides latency/offline emulation and the network information
hint; the fixture enforces the aggregate rate because per-target throttles can
multiply available bandwidth. Lossy-3G cases use deterministic relay stalls,
not a claim of measured physical packet loss. The intermittent profile forces
an actual outage and requires subsequent verified progress.

Final paired timing tables and exact retained artifact paths accompany the private
handoff. This is one local Chromium fixture, not every device or public relay.
