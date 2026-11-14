# Details

## Purpose

Observed frictions from the Phase B daily-use review, 2026-11-14. Review began
at 12:50 UTC and continued through the final fake-relay captures. It included
reading the mixed-language feed, opening actors and quotes, closing tabs in
runs, keyboard navigation, resizing, Settings, composing and switching desks.
All content and accounts were local fixtures; no public relay was contacted.

## Observations

Fixed means implemented and covered by native or browser checks, or directly
visible in the final captures. Open means the friction is still reproducible.

| # | Observed friction | State |
| --- | --- | --- |
| 1 | Closing the active tab chose layout order instead of the last active tab. | fixed |
| 2 | Middle click on a tab did nothing. | fixed |
| 3 | No setting could disable middle-click close. | fixed |
| 4 | Closing a tab could leave keyboard focus on the document body. | fixed |
| 5 | Tab widths changed under the pointer while closing a run. | fixed |
| 6 | A strip with many tabs had no filterable list. | fixed |
| 7 | Scrolling the strip hid New tab and the tile menu. | fixed |
| 8 | Duplicate Settings tabs shared radio groups; changing density unchecked another tab. | fixed |
| 9 | A launcher tab kept its plus icon after becoming a view. | fixed |
| 10 | Escape during a tab drag still allowed the drop. | fixed |
| 11 | Tabs had no right-click actions for Duplicate or Pin. | fixed |
| 12 | Closing a draft gave no indication that its text remained on the device. | fixed |
| 13 | No workspace chips appeared between status and search. | fixed |
| 14 | Discovery layout edits could not be kept independently of Reading. | fixed |
| 15 | A tab could not move to a numbered workspace. | fixed |
| 16 | The relay table overflowed a 520px tile. | fixed |
| 17 | Relay URL minimum widths overflowed at 160px. | fixed |
| 18 | The interface-scale range control extended outside a 160px tile. | fixed |
| 19 | The Relays introduction was a long machine sentence. | fixed |
| 20 | Relay-choice explanation competed with the actual relay rows. | fixed |
| 21 | A double click on a resize handle did not equalise its pair. | fixed |
| 22 | There was no keyboard zoom for inspecting one tile. | fixed |
| 23 | A fresh signed-out visitor saw Welcome instead of real Global notes. | fixed |
| 24 | Global's language selection had no visible, removable explanation. | fixed |
| 25 | The first feed row unnecessarily repeated Today. | fixed |
| 26 | A long note occupied many screens without a fold. | fixed |
| 27 | Newlines around an image URL added more than the intended 8px gap. | fixed |
| 28 | Several images stacked vertically instead of forming two columns. | fixed |
| 29 | A custom reaction in Notifications displayed its literal shortcode. | fixed |
| 30 | Notification time ran directly after the action instead of at the right. | fixed |
| 31 | Notification excerpts used arbitrary character truncation and three lines. | fixed |
| 32 | Reposter attribution opened the reposted note instead of the actor. | fixed |
| 33 | Actors inside a quoted card opened the quoted thread. | fixed |
| 34 | Middle-clicking an actor did not open a background kept tab. | fixed |
| 35 | Empty composer displayed a zero character count. | fixed |
| 36 | The disabled Post button looked like an available indigo action. | fixed |
| 37 | Composer's account hint was two lines with no inline action. | fixed |
| 38 | SVG fixture avatar lettering used the SVG default serif. | fixed |
| 39 | Audio appeared as an ordinary website link. | fixed |
| 40 | Video had a source before the reader chose to load it. | fixed |
| 41 | Time labels never advanced while a note remained mounted. | fixed |
| 42 | Known settled counts continued to display a plus sign. | fixed |
| 43 | Offline status depended on waiting for relay failures. | fixed |
| 44 | There was no media-on-press option for a slow connection. | fixed |
| 45 | Repost still needs a menu press before sending. | open |
| 46 | Quote composition has no one-step action or ready card. | open |
| 47 | Thread reply runs cannot be collapsed. | open |
| 48 | A feed has no visible you-were-here marker. | open |
| 49 | Scrolling far enough still reaches the 600-row cap. | open |
| 50 | The composer does not show whose voice it will use. | open |
| 51 | Uploading by paste, drop or button is unavailable. | open |
| 52 | Settings still contains English explanatory text in Japanese mode. | open |
| 53 | Alt+period/comma still resize proportionally, not by exactly 40px. | open |
| 54 | Sliver action reduction hides Reply without adding it to More. | open |
| 55 | A 56px icon tab cannot also hold a 44px touch close target comfortably. | open |
| 56 | No on-device Translate action appears in the tested Chromium. | open |
| 57 | Workspace switching remounts view bodies rather than keeping all mounted. | open |
| 58 | Global's script filter resets when its tab is remounted. | open |
| 59 | The tab menu has no explicit key binding for every bulk action. | open |
| 60 | Closing a tab offers Undo, but bulk close only reopens the last tab. | open |
