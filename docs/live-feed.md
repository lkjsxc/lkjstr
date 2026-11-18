# Live feed head

## Purpose

How a list shows notes that arrive while it is open: at the top by themselves,
below the top without moving the reader. Records the owner request of
2026-11-18, the cause, the rule now built in `web/src/views/feed.ts`, what was
run and how the change reaches the live site.

## The request and the cause

The owner asked that new posts be fetched and shown at the top without the
new-notes control. The engine already fetched them: relay subscriptions stay
open and every arrival is verified, stored and counted. The interface withheld
them. Since the public view cache landed, every list except a channel and a
thread asked, right after its first rows, for a window anchored on its first
note (`headHeld`). An anchored window receives only a count of the rows above
it, so the count went into the pill and the rows waited for a press. Scrolling
back to the top did not release them either.

## The rule

The window anchor of `protocol.ts` is unchanged: `top` follows the head, a key
holds the list around a row and counts what is above it with `fresh`.

- At the very top (scroll offset under 8 px, tab in front, no row selected by
  the keyboard) the list keeps the `top` window. The engine inserts arrivals
  as patches and the list stays at offset 0. The pill is not offered.
- Anywhere else the window is anchored on a row. The engine keeps fetching and
  counting; the reading position is the anchor row plus offset of
  `feed-place.ts`, and the pill shows the count.
- Reaching the top again, by scrolling or by the pill, asks for `top`: what
  was counted is drawn, in order, and the count is cleared. The upper edge of
  an older page still loads the preceding page if that window omits the head.
- A tab behind another tab does not ask. When it comes to the front at the top
  it asks for `top` at once; below the top it returns to its saved position.
- A row selected by the keyboard holds the list as a scrolled position does.
  Dropping the selection at the top follows the head again.
- A replayed public screen is still pinned to its first note by
  `public-snapshots.ts`, so a partial bootstrap cannot interleave with it. The
  first nonzero `fresh` for a reader at the top is the cue to ask for `top`;
  the replayed rows then follow the arrivals in order. If the reader scrolls
  down and back to the head during partial hydration, the `top` request
  supersedes the held-head request even while its response is withheld.
- Notifications that flow in while the browser page is hidden are drawn but
  not marked read until the page is visible again.

## Duplicates, reconnects and paging

Nothing here is decided in the interface. The engine deduplicates by event id
before a row exists, and a relay that reconnects replays into the same store.
The list applies `rows` and keyed patch operations and never reorders; a row
key is drawn once. Older pages still load when the reader nears the bottom,
and the page above still loads when the reader nears the top of an anchored
window that does not reach the head.

## Limits

- With the real engine a window that has paged down retains up to 6000 rows
  above its anchor. Arrivals enter that window above the reader with the
  position held, so the pill counts only what lies above the retained span.
  The mock engine counts every arrival instead. This predates the change.
- Asking for `top` after a replay drops the replayed count models, as the pill
  press did: counts then come from the engine and can be lower bounds until
  their contributors are restored.
- A busy list at the top moves as fast as notes arrive. Scrolling 8 px or
  selecting a row holds it.
- No engine, protocol, string or style change. The pill, its words and its
  colour are as before.

## Verification (2026-11-18)

In the shipping worktree, the independent warm-return reproduction failed on
`1d83edbc` and passed with the retained fix `d1f7d918`. The full web check,
22 focused tests, mock and real builds, and `pnpm verify:quiet` passed.
The unmodified upstream baseline `b3de286e` passed all 550 real smoke checks
with no page errors, including the earlier two-tab search assertion.

The signed loopback run passed 42 checks over five warm launches with the
production Worker. Home followed arrivals both before and after a page
reload. While scrolled, two arrivals left the same row at the same offset
with 0 px of movement. Scrolling to the top drew both once, in order, and
cleared the pill. Pressing the pill and leaving and returning to the tab
also passed. After a forced disconnect, the fixture delivered the previous
head again on the new connection and its row still occurred once. The
sample recorded no page errors, HTTP requests outside the fixture, or
browser publications. Its Home median first screen was 71.7 ms. The
separate exploratory profile visit waited for the Worker in this run.

Earlier draft and sandbox observations:

- The retained Chromium mock run passed 420 checks with zero failures;
  `tmp/smoke-mock-report.json` records the totals. Its progress showed the
  head changing automatically, the scrolled anchor holding, and scrolling
  back revealing arrivals once. `tmp/audit-mock.json` retains the layout
  audit. A later start truncated the mock progress log before serving.
- The retained real Worker loopback run passed 501 assertions, including
  grouped notification arrivals holding the reading position and becoming
  visible on scroll to the top without a press. It stopped at `a fresh want
  after two tabs reaches the relay`. The earlier run stopped at the Search
  launcher click. See `tmp/smoke-real/report.json` and `tmp/smoke-real.log`.
- The resumed code passed TypeScript, Biome, `pnpm build` and 19 focused tests
  for feeds, notifications and public snapshots. The feed tests cover
  edge-of-window paging, replay, returning to the top and returning to a
  hidden tab. The 12 native cases in
  `engine_cover_resume_test`, `engine_count_route_identity_test` and
  `store_test` passed, including verified duplicates and relay reconnect.
- The resumed environment denied the loopback listen with `EPERM`, blocking
  `pnpm smoke` and `pnpm shots`. The warm-cache browser smoke and a browser
  reconnect run remain pending. The full `pnpm check` also did not pass here;
  the unchanged filter and packaging tests hit `spawnSync ... EPERM` when
  invoking Node and `tar`, respectively.

## Release path

The change is prepared for `stream/live-feed-20261118`, based on upstream
`main` at `b3de286e` as confirmed by GitHub. The worktree's Git metadata was
read-only in the resumed session. `tmp/live-feed-review.bundle` contains the
one review commit with that base as its prerequisite. Fetch its head with
`git fetch tmp/live-feed-review.bundle refs/heads/stream/live-feed-20261118`
and inspect `FETCH_HEAD`.

1. Independent review of the commit against this document.
2. Rebase on `origin/main` if main has moved, then rerun `pnpm check`,
   `pnpm build`, `pnpm smoke` and `pnpm smoke:real` in `web/` with loopback
   available. Check warm replay with `web/scripts/smoke-public-cache.mjs`
   and its signed fixture helper. Verify that re-sending a note after a
   relay reconnect produces one row before proceeding to shipment.
3. Ship with the owner-prescribed entry point from a clean worktree, as
   [engine-shipping.md](engine-shipping.md) describes:
   `/home/coder/workspace/lkjstr-direction-20261116/ship.sh "<one owner line>"`.
   It reruns the web check, real smoke and real build, pushes the pinned
   revision to `main`, uploads the digest-checked archive and records receipts.
4. After activation, open the live site signed in and observe ordinary relay
   traffic. At the top of Home confirm a new note appears without a press;
   scroll down and confirm that the position holds and the pill counts.
   Scroll back to the top and confirm the counted notes appear once, in order.
   Leave the tab and return at the top to confirm it immediately follows again.
