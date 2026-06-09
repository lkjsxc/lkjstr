# Workspace UI

## Purpose

Workspace UI modules render the Rust pane shell, tab strip, Welcome document,
New Tab chooser, and converted Rust tool bodies.

## Table of Contents

- `accounts.rs`: Rust Accounts body.
- `accounts_provider.rs`: accounts command provider wrapper.
- `accounts_row.rs`: row rendering for stored account records.
- `log.rs`: Rust durable lkjstr Log body.
- `log_provider.rs`: app-log read and clear provider wrapper.
- `log_row.rs`: redacted app-log row rendering.
- `menu.rs`: New Tab menu actions.
- `mod.rs`: module exports.
- `pane.rs`: pane chrome and tab rail.
- `persistence.rs`: host persistence callback wrapper.
- `relay_row.rs`: relay row rendering and edit commands.
- `relay_settings.rs`: Rust Relay Settings body.
- `relay_settings_provider.rs`: relay settings command provider wrapper.
- `relay_settings_section.rs`: user/discovery relay-set sections.
- `settings.rs`: Rust Settings body.
- `settings_provider.rs`: settings command provider wrapper.
- `settings_row.rs`: row editor rendering for Settings.
- `shell.rs`: top-level workspace shell.
- `state.rs`: view selectors and command helpers.
- `stats.rs`: Rust Stats body for host-provided diagnostics.
- `stats_bytes.rs`: pressure byte-summary rows for Stats.
- `stats_health.rs`: SQLite worker health rows for Stats.
- `stats_provider.rs`: async Stats snapshot provider wrapper.
- `stats_refresh.rs`: bounded Stats refresh and auto-refresh timers.
- `tab_body.rs`: tab body routing and honest pending states.
- `tweet.rs`: protected Tweet draft editor.
- `tweet_provider.rs`: Tweet draft command provider wrapper.
- `upload_settings.rs`: guided Rust Upload Settings body.
- `upload_settings_provider.rs`: upload settings command provider wrapper.
- `welcome.rs`: document-like Welcome surface.
