# Live feed head

## Purpose

Describe how new rows reach a feed and how a held reading position and
bounded window behave. Record the signed fixture and release path.

## Reading and arrivals

At the top a visible feed follows its head, including after a reload. A
scrolled reader or selected keyboard row holds the window. The Worker
projects arrivals above that window's anchor and the interface draws them as
they arrive. The keeper restores the same note and offset after drawing.
Returning to the top by scrolling shows the new rows and resumes the head.
Pressing the pill requests the head and releases the selection. Both paths
tell the Worker which older row was already loaded. The head window grows
with new arrivals, preserving that older boundary up to 6800 rows. Beyond
the bound the Worker trims the far end. The loaded window and existing relay
history cursor stay with the open tab.

The pill counts projected rows above the reading position or keyboard
selection, up to the last read head.
Headers, day separators and repeated delivery do not count. Grouped
notification rows count once, using the same projection as the visible rows.
A held head reserves room for new rows within an 800-row window. If there
are further arrivals above its bound, the pill shows the retained count
with an overflow marker. Scrolling reaches the retained edge. Pressing the
pill reloads the head, including the notes outside the old window.
Historical paging starts when the viewport is within two and a half pane
heights of the loaded tail. It asks for a 60-row buffer; a tail is requested
once until a new boundary arrives or the reader changes direction. The
Worker can also start one speculative relay page when the projected window
reaches within 60 cached rows of the end.

The interface saves the reading anchor and last read head with the tab. A
warm top snapshot stays intact until the Worker can reconcile it. Its first
count of rows above the snapshot cues a request for the head. A saved
scrolled window retains its exact anchor while the Worker fills the bounded
space above it. A tab behind another waits for visibility before changing
its window. Notifications arriving while the browser page is hidden are
drawn and remain unread until the page becomes visible.

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

The candidate's standard real smoke matched the earlier two-tab search
failure after 501 checks with no page errors. The focused browser trace
confirmed both documents were visible and the first had focus. At the failed
assertion no Search input remained in that document. Bringing it to the front
did not restore the input or send the exact search request to the relay.
The wire assertion stopped this attempt and remains in the release smoke.
See `tmp/evidence/candidate-real-failed.json` and
`tmp/evidence/real-diagnose.log` in the shipping worktree.

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

The Search failure came from sharing one saved workspace in the test.
Global in the second document could write its layout after Search had been
opened in the first, replacing Search and canceling its pending save. The
window-manager regression drives that ordering deterministically. The real
smoke checks same-workspace synchronization separately, then keeps the
second reader on the original Global while the first makes the exact
Search request from workspace 2. Both documents must keep their views visible and still
share a single socket per relay.

Run the frontend and root gates with worktree-local caches and the shared
proof lease. Use the signed loopback fixture before releasing. It exercises
warm startup, reload, anchor position, pill count, the keyboard selection,
overflow, and reconnect at desktop and phone widths.

Rebase on current origin/main. From the clean tested revision run the
[canonical shipping wrapper](engine-shipping.md). It pins the source and
archive, reruns the full real smoke, and uses GitOps `ops/lkjstr.py` for the
locked deployment and HTTPS verification. GitOps verifies every file on
activation and restores the previous pointer on failure. Compare the public
HTTPS index and hashed assets with the archive after activation. Use the
GitOps release record to identify the compatible rollback release.
