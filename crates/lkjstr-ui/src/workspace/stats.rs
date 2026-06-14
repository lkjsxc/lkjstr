use std::time::Duration;

use leptos::prelude::*;
use lkjstr_storage::{StorageInventoryRow, StorageStatsSnapshot};

use crate::app::RuntimeSignal;
use crate::workspace::stats_bytes::storage_byte_rows;
use crate::workspace::stats_geometry::feed_geometry_rows;
use crate::workspace::stats_health::storage_health_rows;
use crate::workspace::stats_provider::StatsProvider;
use crate::workspace::stats_refresh::{StatsRefreshState, refresh_stats};
use crate::workspace::stats_text::{
    available_text, pressure_state_text, pressure_value_text, status_text, unavailable_text,
};

#[component]
pub fn StatsTab(runtime: RuntimeSignal, provider: Option<StatsProvider>) -> impl IntoView {
    let provider = provider.unwrap_or_else(StatsProvider::manifest_only);
    let snapshot = RwSignal::new(None::<StorageStatsSnapshot>);
    let refreshing = RwSignal::new(false);
    let refresh_state = StatsRefreshState::new();

    refresh_stats(provider.clone(), snapshot, refreshing, refresh_state);
    on_cleanup(move || refresh_state.clear_all());

    let refresh_click = {
        let provider = provider.clone();
        move |_| refresh_stats(provider.clone(), snapshot, refreshing, refresh_state)
    };
    let auto_change = move |event| {
        refresh_state.clear_interval();
        if event_target_checked(&event) {
            let provider = provider.clone();
            let handle = set_interval_with_handle(
                move || refresh_stats(provider.clone(), snapshot, refreshing, refresh_state),
                Duration::from_secs(2),
            );
            if let Ok(handle) = handle {
                refresh_state.set_interval(handle);
            }
        }
    };

    view! {
        <section class="data-tab stats-tab lkjstr-stats" aria-label="Stats">
            <header class="lkjstr-stats-actions">
                <button type="button" on:click=refresh_click>
                    {move || if refreshing.get() { "Refreshing storage inventory" } else { "Refresh storage inventory" }}
                </button>
                <label class="stats-auto">
                    <input type="checkbox" on:change=auto_change />
                    <span>"Auto refresh every 2s"</span>
                </label>
            </header>
            <div class="stats-cards">
                <article><strong>{move || runtime.with(|state| state.workspace.tabs.len())}</strong><span>"tabs"</span></article>
                <article><strong>{move || runtime.with(|state| state.workspace.layout.as_ref().map_or(0, |layout| layout.pane_ids().len()))}</strong><span>"panes"</span></article>
                <article><strong>{move || snapshot.get().map_or(0, |item| item.table_count)}</strong><span>"stores"</span></article>
                <article><strong>{move || snapshot.get().map_or(0, |item| item.total_known_rows)}</strong><span>"known rows"</span></article>
            </div>
            <h3>"Cache"</h3>
            <table class="stats-table">
                <tbody>
                    <tr><th>"Inventory status"</th><td>{move || status_text(snapshot.get())}</td></tr>
                    <tr><th>"Available stores"</th><td>{move || available_text(snapshot.get())}</td></tr>
                    <tr><th>"Unavailable stores"</th><td>{move || unavailable_text(snapshot.get())}</td></tr>
                    <tr><th>"Pressure state"</th><td>{move || pressure_state_text(snapshot.get())}</td></tr>
                    <tr><th>"Protected bytes"</th><td>{move || pressure_value_text(snapshot.get(), |item| item.protected_bytes)}</td></tr>
                    <tr><th>"Prunable bytes"</th><td>{move || pressure_value_text(snapshot.get(), |item| item.prunable_bytes)}</td></tr>
                    <tr><th>"Unknown bytes"</th><td>{move || pressure_value_text(snapshot.get(), |item| item.unknown_bytes)}</td></tr>
                    <tr><th>"Residual browser overhead"</th><td>{move || pressure_value_text(snapshot.get(), |item| item.residual_overhead_bytes)}</td></tr>
                </tbody>
            </table>
            <h3>"Storage bytes"</h3>
            <table class="stats-table">
                <thead>
                    <tr><th>"Class"</th><th>"Group"</th><th>"Status"</th><th>"Bytes"</th></tr>
                </thead>
                <tbody>{move || storage_byte_rows(snapshot.get())}</tbody>
            </table>
            <h3>"Storage health"</h3>
            <table class="stats-table">
                <tbody>{move || storage_health_rows(snapshot.get())}</tbody>
            </table>
            <h3>"Feed geometry"</h3>
            <table class="stats-table">
                <tbody>{move || feed_geometry_rows(snapshot.get())}</tbody>
            </table>
            <h3>"Storage inventory"</h3>
            <table class="stats-table">
                <thead>
                    <tr><th>"Store"</th><th>"Group"</th><th>"Status"</th><th>"Rows"</th><th>"Bytes"</th></tr>
                </thead>
                <tbody>{move || inventory_rows(snapshot.get())}</tbody>
            </table>
            <h3>"Relay diagnostics"</h3>
            <p>"Relay snapshots and subscription counters are unavailable until the Rust relay host adapter owns live sessions."</p>
        </section>
    }
}

fn inventory_rows(snapshot: Option<StorageStatsSnapshot>) -> impl IntoView {
    match snapshot {
        Some(snapshot) => snapshot
            .rows
            .into_iter()
            .map(row_view)
            .collect_view()
            .into_any(),
        None => view! {
            <tr><td colspan="5">"Loading storage inventory"</td></tr>
        }
        .into_any(),
    }
}

fn row_view(row: StorageInventoryRow) -> impl IntoView {
    let StorageInventoryRow {
        table,
        group,
        status,
        row_count,
        estimated_bytes,
        problem_reason,
        ..
    } = row;
    let rows = row_count.map_or_else(
        || problem_reason.unwrap_or_else(|| status.clone()),
        |count| count.to_string(),
    );
    view! {
        <tr>
            <td>{table}</td>
            <td>{group}</td>
            <td>{status}</td>
            <td>{rows}</td>
            <td>{byte_text(estimated_bytes)}</td>
        </tr>
    }
}

fn byte_text(estimated_bytes: Option<u64>) -> String {
    estimated_bytes.map_or_else(|| "not-recorded".to_string(), |bytes| bytes.to_string())
}
