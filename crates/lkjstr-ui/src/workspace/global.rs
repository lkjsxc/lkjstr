use leptos::html::Div;
use leptos::prelude::*;
use lkjstr_app::{FeedEventRow, FeedViewRow, GlobalFeedStatus, GlobalFeedView};

use crate::workspace::global_footer::footer_row;
use crate::workspace::global_older::GlobalOlderLoader;
use crate::workspace::global_provider::GlobalFeedProvider;
use crate::workspace::global_scroll::{install_viewport_fill_probe, older_scroll_handler};

#[component]
pub fn GlobalTab(
    owner: String,
    model: GlobalFeedView,
    provider: Option<GlobalFeedProvider>,
) -> impl IntoView {
    let model = RwSignal::new(model);
    let complete = Callback::new(move |next| model.set(next));
    let older_loader = provider
        .as_ref()
        .map(|provider| GlobalOlderLoader::new(owner.clone(), provider.clone(), complete));
    let older_command = older_loader
        .as_ref()
        .map(GlobalOlderLoader::command_callback);
    let older_scroll = older_scroll_handler(older_loader.clone());
    let scroll_node = NodeRef::<Div>::new();
    install_viewport_fill_probe(scroll_node, older_loader.clone(), model);
    if let Some(provider) = provider {
        let read_lease = provider.read(owner, complete);
        let older_loader = older_loader.clone();
        on_cleanup(move || {
            read_lease.release();
            if let Some(loader) = older_loader {
                loader.release();
            }
        });
    }
    view! {
        <section class="lkjstr-global-feed" aria-label="Global">
            <div class="tab-scroll-track event-list__scroller">
                <div
                    class="tab-scroll-owner global-list-scroll"
                    data-scroll-owner=""
                    node_ref=scroll_node
                    on:scroll=older_scroll
                >
                    <p class="lkjstr-feed-status">{move || global_status_text(model.get().status)}</p>
                    <div class="lkjstr-feed-rows">
                        {move || {
                            let older_command = older_command;
                            model
                                .get()
                                .view_model
                                .rows
                                .into_iter()
                                .map(move |row| global_row(row, older_command))
                                .collect_view()
                        }}
                    </div>
                </div>
            </div>
        </section>
    }
}

#[must_use]
pub fn default_global_feed(tab_id: &str) -> GlobalFeedView {
    lkjstr_app::default_global_feed_view(tab_id)
}

fn global_row(
    row: FeedViewRow,
    older_command: Option<Callback<lkjstr_app::GlobalOlderLoadTrigger>>,
) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row(row).into_any(),
        FeedViewRow::Unavailable(row) => view! {
            <article class="lkjstr-feed-row unavailable" data-row-id=row.row_id>
                <strong>{row.reason}</strong>
                <p>{row.detail}</p>
            </article>
        }
        .into_any(),
        FeedViewRow::Diagnostic(row) => view! {
            <article class="lkjstr-feed-row diagnostic" data-row-id=row.row_id>
                <strong>{format!("{:?}", row.severity)}</strong>
                <p>{row.message}</p>
            </article>
        }
        .into_any(),
        FeedViewRow::Continuation(row) => view! {
            <article class="lkjstr-feed-row continuation" data-row-id=row.row_id>
                <strong>{format!("Continue thread ({})", row.hidden_count)}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Footer(row) => footer_row(row, older_command).into_any(),
        FeedViewRow::Profile(row) => view! {
            <article class="lkjstr-feed-row profile" data-row-id=row.row_id>
                <strong>{row.display_name}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Notification(row) => view! {
            <article class="lkjstr-feed-row notification" data-row-id=row.row_id>
                <strong>{row.notification_kind}</strong>
            </article>
        }
        .into_any(),
    }
}

fn event_row(row: FeedEventRow) -> impl IntoView {
    let event_id = row.event_id.clone();
    let row_id = row.row_id.clone();
    let created_at = row.created_at;
    let text_rows = event_text(row);
    view! {
        <article class="lkjstr-feed-row event" data-row-id=row_id data-event-id=event_id>
            <small>{format!("created {created_at}")}</small>
            {text_rows.into_iter().map(|text| view! { <p>{text}</p> }).collect_view()}
        </article>
    }
}

fn event_text(row: FeedEventRow) -> Vec<String> {
    row.visual_rows
        .into_iter()
        .filter_map(|item| match item {
            lkjstr_app::FeedVisualRow::EventFull(row) => Some(row.content),
            lkjstr_app::FeedVisualRow::EventTextSegment(row) => Some(row.text),
            lkjstr_app::FeedVisualRow::EventMediaSegment(row) => {
                Some(format!("media segment {}", row.index))
            }
            lkjstr_app::FeedVisualRow::EventReferenceSegment(row) => {
                Some(format!("reference segment {}", row.index))
            }
            lkjstr_app::FeedVisualRow::EventHeader(_)
            | lkjstr_app::FeedVisualRow::EventActions(_) => None,
        })
        .collect()
}

fn global_status_text(status: GlobalFeedStatus) -> &'static str {
    match status {
        GlobalFeedStatus::NoEnabledRelay => "No enabled relay",
        GlobalFeedStatus::Ready => "Global ready",
        GlobalFeedStatus::Partial => "Global partial",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn global_status_text_names_explicit_states() {
        assert_eq!(global_status_text(GlobalFeedStatus::Ready), "Global ready");
        assert_eq!(
            global_status_text(GlobalFeedStatus::NoEnabledRelay),
            "No enabled relay"
        );
    }
}
