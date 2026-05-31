# Workspace UI

## Purpose

Workspace UI modules render the Rust pane shell, tab strip, Welcome document,
New Tab chooser, and converted Rust tool bodies.

## Table of Contents

- `accounts.rs`: Rust Accounts body.
- `accounts_provider.rs`: accounts command provider wrapper.
- `accounts_row.rs`: row rendering for stored account records.
- `menu.rs`: New Tab menu actions.
- `mod.rs`: module exports.
- `pane.rs`: pane chrome and tab rail.
- `persistence.rs`: host persistence callback wrapper.
- `settings.rs`: Rust Settings body.
- `settings_provider.rs`: settings command provider wrapper.
- `settings_row.rs`: row editor rendering for Settings.
- `shell.rs`: top-level workspace shell.
- `state.rs`: view selectors and command helpers.
- `stats.rs`: Rust Stats body for host-provided diagnostics.
- `stats_provider.rs`: async Stats snapshot provider wrapper.
- `tab_body.rs`: tab body routing and honest pending states.
- `welcome.rs`: document-like Welcome surface.
