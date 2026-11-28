# R0 local resource observations

The observer is disposable, per engine lifetime, and is not a scheduler input.
It has no persistence, consent/upload path, learner, or policy switch. The
baseline decision hook is off unless a local fixture enables it. Harness-only
Worker and SharedWorker handles provide `observe_fetch_decisions(bool)` and
`fetch_records_json()`; native callers use `Network::fetches.inspect`. These
handles are not production page commands. `media.observed` is a local port
message that neither wakes the engine nor changes any existing output.

## Accounting

- One relay envelope record covers the scheduled REQ and EOSE/CLOSED bytes.
  Each matching public event frame contributes its exact UTF-8 application
  bytes once, even on overlapping filters. CLOSE and unrelated control frames
  remain in existing transport counters, not attributed resource totals.
- Event records are annotated when verification/admission resolves. Stored
  bytes are the logical compact-event payload, not an IndexedDB allocation.
  Profile/replaceable resource identity is kind + author; other events use
  event ID. A request envelope has its own hash and may be `Mixed`.
- Link time is an estimate using the observed link state (or existing default
  prior), with one RTT per reused REQ and three for the first REQ on a socket.
  Frame transfer cost is charged separately. It is not TCP/TLS wire metering.
  HTTP body chunks are measured, but a browser fetch may use HTTP cache;
  unobservable cache/connection/link-time values remain unknown. Totals count
  unknown costs separately. Per-load differences can be computed by taking
  snapshots at load boundaries; no implicit reset or load grouping is added.
- Plain images and native media metadata attempts are unmeasured. Their start
  is source assignment (not lazy fetch start); native completion is load or
  loadedmetadata, not all media range traffic. Actual first-byte and cache
  source are unknown. Declared dimensions and existing avatar visibility
  observations are populated when available, without a new layout read.
- Relay zero-yield means no newly admitted verified event before EOSE, after
  the pending verification receipts settle. Replay means the same transmitted
  filter envelope on the same relay, ignoring the ephemeral subscription ID.
  Ghosts count existing resident eviction fences and observed avatar-cache
  committed LRU evictions followed by a fetch stage. They are not a policy.

## Bounds and privacy

4,096 FIFO records; 512 FIFO decisions, with at most 128 candidates and 128
choices each and explicit omitted counts; 1,024 active relay attempts;
4,096 replay keys and 4,096 avatar ghost keys. Lifetime per-class totals
survive ring eviction, with saturating counters and explicit dropped-record
and dropped-decision counters. Hosts are stripped to origins and capped at
320 bytes. IDs, views, slots, envelope identities and URL paths are salted
local hashes; the per-observer random salt is never serialized. A failed
random source disables hashed observations rather than using a public seed.
No raw event content, tags, filter values, error text or account secrets are
retained. DM request members/kinds and AUTH-required relay effects are
excluded; public avatar observation is explicit and defaults off on old or
unmarked avatar clients. Generic emoji rendering is deliberately unobserved
because that path also renders decrypted messages. Public page messages pass
resource URLs transiently to the local worker, which hashes them and retains
only an origin. There is no new server communication.

## Decision seams and remaining measurement work

The log samples the actual relay route candidate/choice list, the physical
request batch, resident retention victim selection, avatar stage admission,
and avatar LRU eviction plans. The `Keep` choice is the victim, not a retained
item; LRU scores are recency counters and resident scores are existing policy
scores. Mixed or incomplete observations must not be used as causal labels.

This is instrumentation groundwork, not full fixture coverage: a later
slice needs explicit public in-memory hit/revalidation boundaries, exact
first-visible/first-painted marks, complete media and shared-envelope
attribution, browser timing/cache provenance where available, and a
paired real-worker fixture covering the additional public HTTP classes.
Unknown values must not be substituted with zero. No learner promotion or
change to cache, admission, route, or rendering policy belongs here.
