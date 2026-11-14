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
| 52 | Settings still contains English explanatory text in Japanese mode. | fixed |
| 53 | Alt+period/comma still resize proportionally, not by exactly 40px. | fixed |
| 54 | Sliver action reduction hides Reply without adding it to More. | fixed |
| 55 | A 56px icon tab cannot also hold a 44px touch close target comfortably. | open |
| 56 | No on-device Translate action appears in the tested Chromium. | open |
| 57 | Workspace switching remounts view bodies rather than keeping all mounted. | open |
| 58 | Global's script filter resets when its tab is remounted. | open |
| 59 | The tab menu has no explicit key binding for every bulk action. | open |
| 60 | Closing a tab offers Undo, but bulk close only reopens the last tab. | open |

## Phase C daily-use review

Reviewed from 13:55 through 14:07 UTC on 2026-11-14, using the running release,
local signed fixtures and the desktop/phone captures. Walkthroughs covered
reading, actors, long notes, image tiles, compose, accounts, search, relay rows,
Settings, closing runs, workspace switching and keyboard navigation. The table
mixes corrected regressions with frictions still visible in this release.

| # | Friction observed in the walkthrough or its captures | State |
| --- | --- | --- |
| 61 | An identical note click reused the hidden neighbour preview. | fixed |
| 62 | Changing tabs added browser Back entries unrelated to reading history. | fixed |
| 63 | A nested clean address requested the favicon relative to that path. | fixed |
| 64 | Welcome remained among the initial inactive tabs. | fixed |
| 65 | Japanese Settings had English accessible names on its controls. | fixed |
| 66 | Composer's Japanese mode still said Post and What's happening. | fixed |
| 67 | Relay rows kept English state labels in Japanese mode. | fixed |
| 68 | Notification verbs and minute labels stayed English. | fixed |
| 69 | Tab close and profile tooltips kept English prose. | fixed |
| 70 | Default workspace names were English in Japanese tooltips. | fixed |
| 71 | Active-account text came from English CSS rather than the word table. | fixed |
| 72 | Storage feedback disappeared with the old Welcome content. | fixed |
| 73 | Keyboard resizing changed a fraction rather than a predictable distance. | fixed |
| 74 | Short feed banners and filter controls used the content area. | fixed |
| 75 | Sliver notes hid Reply without offering it in More. | fixed |
| 76 | The action row stopped widening while its note continued widening. | fixed |
| 77 | Opening from the palette could leave focus on the document body. | fixed |
| 78 | The account menu did not dismiss with Escape. | fixed |
| 79 | Tabs required an Alt chord rather than ordinary arrow navigation. | fixed |
| 80 | Arrow handling also consumed Alt+Left/Right history keys. | fixed |
| 81 | A crowded strip loses most titles and becomes a run of similar icons. | open |
| 82 | Three strip controls leave little room for tabs in a 160px tile. | open |
| 83 | All tabs does not focus its filter automatically. | open |
| 84 | Duplicate and bulk-close menu items have no keyboard hints. | open |
| 85 | Palette choices have no arrow selection or per-choice shortcut hint. | open |
| 86 | The Japanese phone composer has a large blank area below its six lines. | open |
| 87 | Its content-warning checkbox and send button sit far apart. | open |
| 88 | The composer still gives no avatar identifying the sending voice. | open |
| 89 | Reply notifications render as full notes among compact activity rows. | open |
| 90 | Opening Notifications gives no visible read-position feedback. | open |
| 91 | The Global script filter resets after a workspace remount. | open |
| 92 | Account creation has no persistent reminder to back up the new key. | open |
| 93 | A read-only account still sees the generic sign-in account-menu wording. | open |
| 94 | The Settings Data section counts notes but gives no byte estimate. | open |
| 95 | A lower tile's long menu can extend beyond the visible window. | open |
| 96 | Dialogs lack a complete Tab focus trap. | open |
| 97 | Notification excerpts can end in an ellipsis inside a Japanese sentence. | open |
| 98 | Image tiles have no visible fit/original-size choice. | open |
| 99 | Help shows physical key names that remain English in Japanese mode. | open |
| 100 | Small account action targets still need a complete touch review. | open |
