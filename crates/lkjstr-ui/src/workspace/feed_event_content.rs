use leptos::{ev::MouseEvent, prelude::*};
use lkjstr_app::feed::{FeedEventContent, FeedEventContentRow};

pub(crate) fn event_content(content: FeedEventContent) -> impl IntoView {
    match content {
        FeedEventContent::Sensitive { reason, rows } => sensitive_content(reason, rows).into_any(),
        FeedEventContent::Rows(rows) => text_rows_view(rows).into_any(),
    }
}

fn sensitive_content(reason: Option<String>, rows: Vec<FeedEventContentRow>) -> impl IntoView {
    let revealed = RwSignal::new(false);
    view! {
        {move || {
            if revealed.get() {
                text_rows_view(rows.clone()).into_any()
            } else {
                sensitive_warning(reason.clone(), revealed).into_any()
            }
        }}
    }
}

fn sensitive_warning(reason: Option<String>, revealed: RwSignal<bool>) -> impl IntoView {
    let reveal = move |_event: MouseEvent| revealed.set(true);
    view! {
        <aside class="content-warning">
            <strong>"Sensitive content"</strong>
            {warning_reason(reason)}
            <button type="button" on:click=reveal>"Reveal"</button>
        </aside>
    }
}

fn warning_reason(reason: Option<String>) -> impl IntoView {
    reason.map(|reason| view! { <span>{reason}</span> })
}

fn text_rows_view(rows: Vec<FeedEventContentRow>) -> impl IntoView {
    rows.into_iter()
        .map(|row| view! { <p>{row.text().to_owned()}</p> })
        .collect_view()
}
