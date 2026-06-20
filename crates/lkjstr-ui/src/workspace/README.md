# Workspace UI

## Purpose

Workspace UI modules render the Rust pane shell, tab strip, Welcome document,
New Tab chooser, and converted Rust tool bodies.

## Table of Contents

- `accounts.rs`: Rust Accounts body.
- `accounts_provider.rs`: accounts command provider wrapper.
- `accounts_row.rs`: row rendering for stored account records.
- `author_context.rs`: narrow Rust Author Context feed row rendering.
- `author_context_actions.rs`: Author Context row action callback bundle.
- `author_context_event.rs`: Author Context event row actions.
- `author_context_open.rs`: Author Context row action tab-opening helpers.
- `author_context_provider.rs`: async Author Context feed provider wrapper.
- `custom_request.rs`: Rust Custom Request app-owned result feed body.
- `custom_request_provider.rs`: async Custom Request view-model provider wrapper.
- `custom_request_render.rs`: Custom Request shared feed-row rendering.
- `custom_request_run.rs`: leased Custom Request run-command helper.
- `custom_request_snapshot.rs`: Custom Request feed filter-state snapshots.
- `feed_event_actions.rs`: shared Rust feed event-row action buttons.
- `feed_event_content.rs`: shared Rust feed event-row content rendering.
- `feed_event_link.rs`: shared Rust feed safe external link rendering.
- `feed_event_menu.rs`: shared Rust feed nearby/copy event menu rendering.
- `feed_event_media.rs`: shared Rust feed media attachment rendering.
- `feed_event_open.rs`: workspace tab callbacks for shared event menus.
- `feed_event_profile_mention.rs`: shared Rust profile mention rendering.
- `feed_event_reference.rs`: shared Rust unavailable reference rendering.
- `feed_event_row.rs`: shared Rust feed event-row body rendering.
- `feed_event_sensitive.rs`: shared Rust sensitive-warning rendering.
- `feed_footer_row.rs`: shared Rust feed footer shell rendering.
- `feed_footer_text.rs`: shared Rust feed footer text mapping.
- `feed_state_row.rs`: shared Rust feed state-row rendering.
- `followees.rs`: narrow Rust Followees rows from real NIP-02 entries.
- `followees_provider.rs`: async Followees view-model provider wrapper.
- `followees_read.rs`: leased Followees initial and retry read-command helper.
- `global.rs`: narrow Rust Global feed row rendering.
- `global_footer.rs`: Global footer text and older-command rendering.
- `global_older.rs`: leased Global older-load command helper.
- `global_provider.rs`: async Global feed view-model provider wrapper.
- `global_scroll.rs`: Global scroll and viewport-fill older-load gates.
- `home.rs`: narrow Rust Home feed row rendering.
- `home_provider.rs`: async Home feed view-model provider wrapper.
- `log.rs`: Rust durable lkjstr Log body.
- `log_provider.rs`: app-log read and clear provider wrapper.
- `log_row.rs`: redacted app-log row rendering.
- `local_lease.rs`: shared release cleanup state for async provider leases.
- `menu.rs`: New Tab menu actions.
- `mod.rs`: module exports.
- `notifications.rs`: narrow Rust Notifications feed row rendering.
- `notifications_footer.rs`: Notifications footer text and older-command rendering.
- `notifications_older.rs`: leased Notifications older-load command helper.
- `notifications_provider.rs`: async Notifications feed view-model provider wrapper.
- `notifications_scroll.rs`: Notifications downward near-end scroll intent wiring.
- `pane.rs`: pane chrome and tab rail.
- `persistence.rs`: host persistence callback wrapper.
- `profile.rs`: narrow Rust Profile feed row rendering.
- `relay_row.rs`: relay row rendering and edit commands.
- `relay_settings.rs`: Rust Relay Settings body.
- `relay_settings_provider.rs`: relay settings command provider wrapper.
- `relay_settings_section.rs`: user/discovery relay-set sections.
- `search.rs`: narrow Rust Search idle and partial-state feed rendering.
- `search_run.rs`: leased Search primary query command helper.
- `search_older.rs`: leased Search older-load command helper.
- `settings.rs`: Rust Settings body.
- `settings_provider.rs`: settings command provider wrapper.
- `settings_row.rs`: row editor rendering for Settings.
- `shell.rs`: top-level workspace shell.
- `state.rs`: view selectors and command helpers.
- `stats.rs`: Rust Stats body for host-provided diagnostics.
- `stats_actions.rs`: explicit storage action capability rendering.
- `stats_bytes.rs`: pressure byte-summary rows for Stats.
- `stats_geometry.rs`: feed row-height aggregate rows for Stats.
- `stats_health.rs`: SQLite worker health rows for Stats.
- `stats_text.rs`: pure Stats summary and pressure text helpers.
- `stats_provider.rs`: async Stats snapshot provider wrapper.
- `stats_refresh.rs`: bounded Stats refresh and auto-refresh timers.
- `tab_body.rs`: tab body routing and honest pending states.
- `thread_footer.rs`: Thread footer text and older-command rendering.
- `thread_older.rs`: leased Thread older-load command helper.
- `thread_scroll.rs`: Thread scroll-triggered older-load gate.
- `tweet.rs`: protected Tweet draft editor.
- `tweet_provider.rs`: Tweet draft command provider wrapper.
- `upload_settings.rs`: guided Rust Upload Settings body.
- `upload_settings_provider.rs`: upload settings command provider wrapper.
- `user_timeline.rs`: narrow Rust User Timeline feed row rendering.
- `user_timeline_provider.rs`: async User Timeline feed provider wrapper.
- `welcome.rs`: document-like Welcome surface.
