# Interface specification: one event, one moment

## Purpose

The owner saw the same event appear in the Home tab and in the Notifications tab at slightly different times
(2026-11-17) and asked whether the tabs cooperate yet. They do not: each open tab draws an event when its own request
delivers it, so two tabs that both hold the event disagree for as long as their routes differ. A reader takes that
for a slow or broken client. Index and rules: [interface-specs.md](interface-specs.md). No new surface, colour or
word; this item is a behaviour of every existing feed.

## S1 One event, one moment

"Tab" is a tab of the workspace (Home, Notifications, a profile, a thread, a channel), in any pane or browser tab.

- The moment an event is verified and stored, whichever request brought it, every open top window whose rows would
  include it receives it in the same patch turn (the existing 75 ms batch). No tab waits for its own relay to send
  the same event again. A reply to the reader that Home received is a Notifications row in that turn, and a note of
  a followed author that only the Notifications or a profile request received is in Home in that turn.
- The same holds for everything drawn from an event: reaction, repost, reply and zap counts, the reader's own heart
  and repost marks, a deletion, a changed name or picture, a mute. One value, the same in every tab, changed in the
  same turn.
- A tab that keeps arrivals behind its "new" mark instead of inserting them counts the event in that mark in the
  same turn. The unread mark of Notifications changes in that turn as well.
- A hidden tab receives nothing while hidden. When it is shown it is brought up to date from stored events before
  any relay answers, in its first patch.
- Relative times ("3m") are computed from one clock tick shared by all tabs: a row never reads "2m" in one tab while
  the same event reads "3m" in another.
- Rows keep their order rule (chronological by the event's own time). Only the moment of drawing is shared.
- Nothing here adds a relay request. A tab's own request stays as it is; its duplicate delivery is dropped as today.

## Checks

- A fixture with Home and Notifications open on two routes: one route delivers a reply to the reader at once, the
  other five seconds later. Both tabs show the row within 100 ms of each other. The same with the routes swapped.
- The same fixture for a reaction count on a note visible in Home and in a thread tab, and for a deletion.
- A hidden Notifications tab shown after ten arrivals holds all ten in its first patch, with no request sent first.
- One public-relay minute with Home, Notifications and one profile open: the trace holds no event drawn in two tabs
  more than 100 ms apart. The number goes into the cache and first-paint measurements.

## Order

This belongs to the cache and first-paint work in progress and is taken with it; it does not wait for A1 and A2.
If the engine already delivers stored events to every matching window, find what delayed the observed row (a
separate notification index pass, a second verification, a batch of its own) and remove that instead.
