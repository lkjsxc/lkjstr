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

## CachyOS measurements

On 2026-11-20, headless Chromium 156.0.8078.4 on the Ryzen 7 7840HS
ran production assets in disposable profiles. The comparison used the same
6,000 signed feed fixtures, five visible 800-row windows and loopback relay
timers. The baseline was d21ec05b with timing probes. The probes exercised
real Post and reaction clicks before sending measured action batches through
the same Worker protocol. The page reports note signing at `publish.signed`.
Reactions use the verified Worker stage. UIs intentionally hold reactions
for Undo. In the loops that used the real gesture the hold was about 8,001 ms.
In the after heavy-post run the Post click reached dispatch in 1.3 ms. The
reaction reached a relay frame 4.9 ms after its hold. The frame is a later
boundary than verification.

| Scenario, stage and build | n | p50 / p95 ms | p99 ms | Max ms | >300 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Heavy post, Worker verified (before) | 220 | 271.1 / 621.4 | 669.5 | 690.2 | 100 |
| Heavy post, Worker verified (after) | 220 | 91.0 / 193.4 | 207.6 | 211.9 | 0 |
| Heavy post, page signed (before) | 220 | 271.8 / 622.4 | 679.0 | 691.3 | 100 |
| Heavy post, page signed (after) | 220 | 130.3 / 198.0 | 211.0 | 297.1 | 0 |
| Heavy reaction, Worker verified (before) | 220 | 2115.5 / 3236.1 | 3611.4 | 3640.0 | 209 |
| Heavy reaction, Worker verified (after) | 220 | 102.3 / 229.4 | 250.2 | 256.0 | 0 |
| Paced reaction, Worker verified (after) | 220 | 107.3 / 247.6 | 295.0 | 314.2 | 2 |
| Warm post, Worker verified (before) | 220 | 2.1 / 4.7 | 7.2 | 8.1 | 0 |
| Warm post, Worker verified (after) | 220 | 1.9 / 3.4 | 5.6 | 6.4 | 0 |
| Warm post, page signed (before) | 220 | 16.8 / 31.9 | 34.0 | 35.4 | 0 |
| Warm post, page signed (after) | 220 | 15.8 / 28.9 | 31.7 | 32.7 | 0 |
| Protected post, Worker verified (after) | 40 | 1.7 / 2.4 | 2.6 | 2.6 | 0 |
| NIP-07 fixture, signer response (after) | 24 | 88.6 / 91.5 | 92.9 | 92.9 | 0 |
| NIP-46 fixture, signer response (after) | 24 | 24.9 / 27.7 | 29.2 | 29.2 | 0 |

Cold navigation to Worker ready took about 104-115 ms across these profiles.
A separate protected unlock took 611 ms including its 604 ms Worker
key operation. The NIP-07 fixture introduces an 80 ms signer delay.
The NIP-46 measurements include encrypted requests to a loopback bunker.
User authorization and Internet signer latency remain unmeasured.

For local actions the key and signature work took roughly 1 ms. Most of the
baseline tail preceded Worker receipt. In the first heavy 220-post run the
slow receipts' output overlap was 407 ms at p50 and 469 ms at max. Feed patch
projection rebuilt row models when arrivals only changed their positions.
The Worker now retains unchanged models by identity and translates derived
sources once per patch. Reactions share the next relay-planning pass. The
engine combines duplicate planning triggers and checks historical relay
eligibility before scanning retained rows for speculative pages.

The first relay reply and Worker scheduling are distinct stages.

| Scenario, stage and build | n | p50 / p95 ms | p99 ms | Max ms | >300 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Heavy post, dispatch to frame (before) | 220 | 890.9 / 1316.8 | 1376.7 | 1384.0 | 219 |
| Heavy post, dispatch to frame (after) | 220 | 307.1 / 425.6 | 449.8 | 454.3 | 121 |
| Heavy post, frame to fixture OK (before) | 220 | 15.4 / 16.0 | 16.1 | 16.1 | 0 |
| Heavy post, frame to fixture OK (after) | 220 | 15.4 / 15.8 | 16.4 | 16.4 | 0 |
| Heavy post, signed to observed acceptance (after) | 220 | 238.7 / 261.2 | 272.2 | 277.3 | 0 |
| Heavy reaction, signed to observed acceptance (after) | 74 | 232.8 / 304.9 | 315.4 | 315.4 | 6 |
| Paced reaction, signed to observed acceptance (after) | 220 | 286.1 / 353.2 | 374.1 | 377.8 | 91 |
| Warm post, signed to observed acceptance (after) | 220 | 31.0 / 43.2 | 44.1 | 44.9 | 0 |

In the baseline the Worker recorded acceptance when emitting the result,
so the earlier relay-stage measurements include that extra result-queue time.
During the intentionally excessive reaction burst, 92 baseline and 74 new
actions reached a relay. The 64-outstanding publication cap stays in place.
Both builds signed all 220 actions. The new build checks capacity before
inserting a reaction into the displayed store. A separate paced run sent
220 reactions every 500 ms during a longer feed load. All 220 reached first
acceptance. Two signatures took over 300 ms, both delayed before Worker receipt.

The heavy post snapshots progressed from 1,155 verified network events to
2,275. Heavy reaction snapshots progressed from 1,219 to 5,020. The fixture
offered the same finite feed. Live request availability determined how many
frames could be sent, and the timed snapshots can leave work queued. The
paced run reached 6,003 verified network events including the fixture setup.
The checked 800-row window kept distinct keys in chronological order.
Full-versus-patch native checks cover content-only count updates, held anchors
and projected Profile membership.

## Reproduce

Use a fresh worktree-local report directory and the real package.

```sh
pnpm --dir web build:real
pnpm bench:signing dist heavy-post
FEED_VIEWS=0 pnpm bench:signing dist warm-post
SIGN_MODE=reaction pnpm bench:signing dist paced-reaction
SIGN_MODE=reaction SAMPLE_INTERVAL=145 FEED_BURST=34 ACCEPT_DELIVERY_FAILURES=1 \
  pnpm bench:signing dist heavy-reaction
```

Set `SIGNER=protected`, `SIGNER=extension` or `SIGNER=remote` to select
a different signer. `LKJSTR_CHROME` selects the headless browser binary.
Reports and the reusable public feed fixture live in `tmp/signing-latency/`
by default. The runner uses loopback endpoints and a new browser context
and reports timing rather than account identifiers or event bodies.
