use leptos::{ev::MouseEvent, prelude::*};

use crate::workspace::stats_action_provider::{StatsActionResult, StatsActions};

pub(crate) fn storage_action_view(actions: StatsActions) -> impl IntoView {
    let status = RwSignal::new(String::new());
    let compact_action = actions.clone();
    let repair_action = actions.clone();
    let compact_click = move |_event: MouseEvent| {
        status.set("Compacting storage".to_string());
        compact_action.compact(result_callback(status));
    };
    let repair_click = move |_event: MouseEvent| {
        status.set("Planning storage repair".to_string());
        repair_action.repair(result_callback(status));
    };
    let unavailable = (!actions.has_any_action()).then(|| actions.unavailable_text());
    view! {
        <h3>"Storage actions"</h3>
        <div class="lkjstr-stats-actions">
            {actions.can_compact().then(|| view! {
                <button type="button" on:click=compact_click>"Compact now"</button>
            })}
            {actions.can_repair().then(|| view! {
                <button type="button" on:click=repair_click>"Repair storage"</button>
            })}
            {unavailable.map(|text| view! { <p role="status">{text}</p> })}
            {move || action_status(status.get())}
        </div>
    }
}

fn result_callback(status: RwSignal<String>) -> Callback<StatsActionResult> {
    Callback::new(move |result: StatsActionResult| status.set(result.status))
}

fn action_status(text: String) -> Option<impl IntoView> {
    (!text.is_empty()).then(|| view! { <p role="status">{text}</p> })
}
