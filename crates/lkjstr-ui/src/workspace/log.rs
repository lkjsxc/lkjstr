use leptos::prelude::*;

use crate::workspace::log_provider::{LogProvider, LogResult};
use crate::workspace::log_row::log_row;

#[component]
pub fn LogTab(provider: Option<LogProvider>) -> impl IntoView {
    let provider = provider.unwrap_or_else(LogProvider::unavailable);
    let result = RwSignal::new(None::<LogResult>);
    let busy = RwSignal::new(false);
    load_log(provider.clone(), result, busy);

    let refresh = {
        let provider = provider.clone();
        move |_| load_log(provider.clone(), result, busy)
    };
    let clear = {
        let provider = provider.clone();
        move |_| clear_log(provider.clone(), result, busy)
    };

    view! {
        <section class="data-tab log-tab lkjstr-log" aria-label="lkjstr Log">
            <header class="lkjstr-log-actions">
                <button type="button" on:click=refresh>
                    {move || if busy.get() { "Refreshing log" } else { "Refresh log" }}
                </button>
                <button type="button" on:click=clear disabled=move || busy.get()>
                    "Clear durable log"
                </button>
            </header>
            <p>{move || status_text(result.get())}</p>
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>"Time"</th><th>"Level"</th><th>"Area"</th>
                        <th>"Code"</th><th>"Message"</th><th>"Context"</th>
                    </tr>
                </thead>
                <tbody>{move || row_views(result.get())}</tbody>
            </table>
        </section>
    }
}

fn load_log(provider: LogProvider, result: RwSignal<Option<LogResult>>, busy: RwSignal<bool>) {
    busy.set(true);
    provider.read(complete(result, busy));
}

fn clear_log(provider: LogProvider, result: RwSignal<Option<LogResult>>, busy: RwSignal<bool>) {
    busy.set(true);
    provider.clear(complete(result, busy));
}

fn complete(result: RwSignal<Option<LogResult>>, busy: RwSignal<bool>) -> Callback<LogResult> {
    Callback::new(move |next| {
        let _unused = result.try_set(Some(next));
        let _unused = busy.try_set(false);
    })
}

fn status_text(result: Option<LogResult>) -> String {
    result.map_or_else(
        || "Loading durable log rows".to_string(),
        |result| result.status,
    )
}

fn row_views(result: Option<LogResult>) -> impl IntoView {
    match result {
        Some(result) if !result.rows.is_empty() => result
            .rows
            .into_iter()
            .map(log_row)
            .collect_view()
            .into_any(),
        Some(_) => view! { <tr><td colspan="6">"No durable log rows"</td></tr> }.into_any(),
        None => view! { <tr><td colspan="6">"Loading durable log rows"</td></tr> }.into_any(),
    }
}
