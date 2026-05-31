use std::time::Duration;

use leptos::prelude::*;
use lkjstr_storage::{StorageInventoryRow, StorageStatsSnapshot};

use crate::app::RuntimeSignal;
use crate::workspace::stats_provider::StatsProvider;

#[component]
pub fn StatsTab(runtime: RuntimeSignal, provider: Option<StatsProvider>) -> impl IntoView {
    let provider = provider.unwrap_or_else(StatsProvider::manifest_only);
    let snapshot = RwSignal::new(None::<StorageStatsSnapshot>);
    let refreshing = RwSignal::new(false);
    let timer = RwSignal::new(None::<IntervalHandle>);

    refresh_stats(provider.clone(), snapshot, refreshing);
    on_cleanup(move || clear_timer(timer));

    let refresh_click = {
        let provider = provider.clone();
        move |_| refresh_stats(provider.clone(), snapshot, refreshing)
    };
    let auto_change = move |event| {
        clear_timer(timer);
        if event_target_checked(&event) {
            let provider = provider.clone();
            let handle = set_interval_with_handle(
                move || refresh_stats(provider.clone(), snapshot, refreshing),
                Duration::from_secs(2),
            );
            if let Ok(handle) = handle {
                timer.set(Some(handle));
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
                    <tr><th>"Pressure state"</th><td>"unavailable in Rust Stats"</td></tr>
                    <tr><th>"Unknown/browser overhead"</th><td>"unavailable in Rust Stats"</td></tr>
                </tbody>
            </table>
            <h3>"Storage inventory"</h3>
            <table class="stats-table">
                <thead>
                    <tr><th>"Store"</th><th>"Group"</th><th>"Status"</th><th>"Rows"</th></tr>
                </thead>
                <tbody>{move || inventory_rows(snapshot.get())}</tbody>
            </table>
            <h3>"Relay diagnostics"</h3>
            <p>"Relay snapshots and subscription counters are unavailable until the Rust relay host adapter owns live sessions."</p>
        </section>
    }
}

fn refresh_stats(
    provider: StatsProvider,
    snapshot: RwSignal<Option<StorageStatsSnapshot>>,
    refreshing: RwSignal<bool>,
) {
    refreshing.set(true);
    let complete = Callback::new(move |next| {
        snapshot.set(Some(next));
        refreshing.set(false);
    });
    provider.read(complete);
}

fn clear_timer(timer: RwSignal<Option<IntervalHandle>>) {
    if let Some(handle) = timer.get_untracked() {
        handle.clear();
        timer.set(None);
    }
}

fn status_text(snapshot: Option<StorageStatsSnapshot>) -> String {
    snapshot.map_or_else(|| "loading".to_string(), |item| item.inventory_status)
}

fn available_text(snapshot: Option<StorageStatsSnapshot>) -> String {
    snapshot.map_or_else(
        || "loading".to_string(),
        |item| format!("{}/{}", item.available_table_count, item.table_count),
    )
}

fn unavailable_text(snapshot: Option<StorageStatsSnapshot>) -> usize {
    snapshot.map_or(0, |item| item.unavailable_table_count)
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
            <tr><td colspan="4">"Loading storage inventory"</td></tr>
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
        </tr>
    }
}
