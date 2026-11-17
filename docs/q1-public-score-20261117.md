# Q1 accepted matched public read score (2026-11-17)

## Purpose

Record the accepted matched public score of the Q1 planner and first-paint candidate.
It does not by itself declare a production deployment or whole-relay recall.

The first three matched Q5 public attempts were rejected under the unchanged
no-regression rule. In the third pair requests and duplicates fell, but the
candidate downloaded a giant kind-3 follower lookup more than once: one route
returned nearly 12 MiB twice and additional routes returned several MiB.
The browser queue had room for only 8 MiB of pending signature verification.
A full response could therefore trigger replay before verified delivery.

The bounded verification queue now holds at most 32 MiB, retaining full reply
bursts until a verification slice can run while still refusing unbounded
traffic. The focused 200-event, over-12-MiB queue test passes and confirms
overflow still drops safely. Completed follower first-page evidence lasts
five minutes per original relay/filter, without falsely marking the list
exhausted. Interrupted still-wanted expensive pages retain their reply.
This does not change the interface or increase public read permissions.

The accepted read-only public comparison used a frozen busy account, five
simultaneously visible views, identical candidate-relay allowlists and
verified witnesses. Candidate capture began 09:37:06 UTC and the unchanged
release baseline began 09:42:15 UTC, so the paired window is comparable.
Both captured all 100 of 100 eligible signed witnesses. The unverified-wire
count is reported separately from queue-overflow diagnosis.

| Q5 public metric | Baseline | Q1 candidate |
| --- | ---: | ---: |
| Requests | 894 | 567 |
| Connection attempts | 24 | 21 |
| Duplicate wire events | 3394 | 1905 |
| Received wire bytes | 20559465 | 20168708 |
| Verified witnesses | 100/100 | 100/100 |
| First screen, ms | 1664.4 | 753.6 |
| Unverified wire events | 52 | 0 |

Normalized per wanted new event, requests fell 36.6%, connections 12.6%,
duplicates 43.9% and inbound bytes 3.2%. The visible-first-screen guard
improved 54.7%. The Q5 comparator returned comparable=true, keep=true and
problems=[]. The independent baseline and candidate data are under
tmp/q1-public-baseline-for-queue32-20261117-0942/ and
tmp/q1-public-candidate-queue32-20261117-0940/. The snapshot makes no claim
about the entire public event universe, other days or WAN-first-paint parity.

The complete core test gate, Rust/WASM release gate, repository check,
frontend check and real build pass on the queue change. The final production
Worker browser gate and prescribed deployment remain separate checks; this
score alone is not a shipped release.
