# Engine polish

## Purpose

Record engine-only first-visitor improvements, measurements and owner handoff.

## Names and counts

Visible authors (including quotes, replies and repost headers) share kind-0
batches, up to 6000 authors per view and 120 per relay request. Delivering read
relays are tried first, then fallback reads. Cached names render immediately;
requests remain for background refresh and release with hidden/closed views.
In-flight batches remain stable during note arrival to preserve delayed replies.
Every row author is reserved before recursive context hydration uses its bound.
Profile work may pause another request; that request resumes after completion.
With 240 ms loopback responses and occupied slots, note-to-named-row latency
was 1893.7 ms before, 232.5 ms after. The congestion clears after 1500 ms;
the revised scheduler delivers names before that. The probe is in engine-check.

Integration keeps the frontend protocol 2 shapes. Unknown profile counts are
absent. Successful, untruncated requests can establish exact counts; pending,
failed and truncated requests cannot. Known empty following lists are zero.
Visible note count lookups batch at 120 IDs, with 200-event pages; a full page
stays partial. Zap receipt trust remains incomplete, so observed untrusted
receipts keep note totals partial. No estimate objects cross the wire.

## Signed-out Global policy

EngineConfig.signedOutGlobalFilter is optional, default true. Only Global
without an account is filtered. Signed-in feeds and other sources are unchanged.
The policy refills up to 301 retained rows, scanning at most 6000 cached rows,
newest first, with three retained notes per author. Exact or near copies collapse within ten
minutes. Near copies need eight tokens, 40 characters and 90 percent token
similarity after case/punctuation/URL/number normalization. Tokenization reads
at most 4096 characters and 256 words per note. Profile absence only filters
after every matching lookup succeeds with an untruncated EOSE response.
Failed or truncated termination permits fallback but cannot prove absence. The raw window remains the hydration
source, so held notes do not cancel lookups or restart a filtering loop.
All window consumers share the refilled raw span. Underfilled windows advance
relay history without needing a retained row as a frontend anchor.

## Manual public sample

One successful read-only sample from wss://nos.lol: 200 kind-1 notes, 87 profile
rows, successful EOSE on the note request and both profile batches. All
signatures verified; zero rejects. No account, publishing or external service.
The first connection attempt to relay.damus.io failed with HTTP 521 and yielded
no sample. Public traffic is deliberately absent from automated checks.

Held back: 65/200 (32.5 percent): 33 author cap, 30 no profile, two duplicates.
The offline analyzer uses the same classifier over a 200-row window. Production
windows may be smaller, so these are sample counts, not a production prediction.
Ten examples follow; text is the first 60 Unicode characters, JSON escaped to
keep this document ASCII. Unescaped data and all 65 rows are in
`tmp/public-sample/report.json`; public events are in events.json beside it.

1. 8054d32f6d7b (NoProfile):

```text
"Zionist Susie Wiles has exited the White House as Chief of S"
```

2. Maddox (AuthorCap):

```text
"HRT heart all-clear? One unreviewed study, tiny gaps\n\nNo.\n\n2"
```

3. 0fd8b920dee5 (NoProfile):

```text
"\ud83d\udd34 LIVE NOW!\n\nACCIDENTALLY INTERESTING - Accidentally Interes"
```

4. 225bd271a208 (NoProfile):

```text
"\u4eca\u65e5\u6050\u614c\u8d2a\u5a6a\u6307\u6570\u964d\u81f3 10\uff0c\u5e02\u573a\u5904\u4e8e\u300c\u6781\u5ea6\u6050\u614c\u72b6\u6001\u300d\n\nForesight News \u6d88\u606f\uff0c\u636e Alternative."
```

5. e4f9ab96540d (NoProfile):

```text
"\u2704------------ 9:30 ------------\u2704"
```

6. 777902bc2dbf (NoProfile):

```text
"If you have an idle RTL-SDR, consider pointing it at Spectru"
```

7. Maddox (AuthorCap):

```text
"Plant-milk iodine scare overreaches: intake modelled, defici"
```

8. 1066a05d1474 (NoProfile):

```text
"\u304a\u306f\u306e"
```

9. Maddox (AuthorCap):

```text
"Neither framing holds: a water-and-AI protest that also chan"
```

10. Oshi (AuthorCap):

```text
"I don't have any"
```

## Owner decisions

The sample contains conversational notes among the held rows. Decide whether
three notes per author and withholding profileless authors are acceptable for
first-time visitors. Disable signedOutGlobalFilter to compare. Rendering unknown
counts needs the interface owner's change; no strings, CSS or markup changed.

## One product

The Leptos UI/runtime and exclusive root HTML, styles, icons and browser
checks are removed. crates/lkjstr-engine-worker replaces the Worker crate;
Cargo.toml is a virtual workspace. The generated engine asset basename stays
lkjstr_engine, preserving transport imports. Root release gates build web/
with the real engine. Shared static icons and browser-relay.mjs remain used.
Docker configuration follows this product, but Docker is unavailable here.

## Gates and files

All requested available gates pass: check:repo, test:quiet, rust-wasm:quiet,
verify:quiet, engine-check.sh, and web/ check, build, smoke, build:real and
smoke:real. The Worker has 54 conformance checks plus the delayed profile probe;
the real app has 13 browser checks and no page errors. Eleven new native
regressions and one mock count regression cover this change. Docker remains
not tested because it is unavailable. Jobs/workers were capped at four.

Main files: core engine hydration.rs, network_profiles.rs, global.rs,
wire/counts.rs and engine tests; the renamed lkjstr-engine-worker crate;
web/src/engine/protocol.ts and mock/rows.ts; engine/profile/public-sample scripts;
root Cargo/package/Docker gates; README.md, AGENTS.md and the architecture,
status, verification and integration docs. web/scripts/smoke.ts now uses a
fresh port and blocks external traffic. The conformance upload signer snapshot
is captured before starting the upload to avoid dropping a fast response.

Deleted: crates/lkjstr-web/, root index.html, exclusive static styles/icons,
and browser drivers that only exercised that interface. Shared icons and the
loopback browser-relay.mjs fixture helper remain. No CI workflow, product
strings, CSS, markup or layout were edited. No commit or deployment was made.
