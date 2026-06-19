use leptos::prelude::*;
use lkjstr_app::{
    SearchFeedView, default_search_feed_view, partial_search_feed_view, pending_search_feed_view,
};

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::search_provider::{SearchFeedLease, SearchFeedProvider};
use crate::workspace::search_render::{search_row, search_status_text};
use crate::workspace::search_snapshot::SearchSnapshotHandle;

const SEARCH_PROVIDER_GAP: &str = "Rust Search provider execution is not wired yet.";

#[component]
pub fn SearchTab(
    owner: String,
    model: SearchFeedView,
    provider: Option<SearchFeedProvider>,
    snapshot: SearchSnapshotHandle,
    #[prop(optional)] actions: FeedEventActions,
) -> impl IntoView {
    let model = RwSignal::new(model);
    let query = RwSignal::new(snapshot.restored_query());
    let active_lease = RwSignal::new(None::<SearchFeedLease>);
    let active_older_lease = RwSignal::new(None::<SearchFeedLease>);
    let older_command = older_command(owner.clone(), model, provider.clone(), active_older_lease);
    let input_snapshot = snapshot.clone();
    let input_query = move |event| {
        let value = event_target_value(&event);
        query.set(value.clone());
        input_snapshot.save_query(value);
    };
    let submit_owner = owner.clone();
    let submit_snapshot = snapshot.clone();
    let submit_provider = provider.clone();
    let submit = move |event: leptos::ev::SubmitEvent| {
        event.prevent_default();
        release_current(active_lease);
        release_current(active_older_lease);
        let text = query.get_untracked();
        submit_snapshot.save_query(text.clone());
        let trimmed = text.trim();
        if trimmed.is_empty() {
            model.set(default_search_feed_view(&submit_owner));
            return;
        }
        if let Some(provider) = submit_provider.clone() {
            model.set(pending_search_feed_view(&submit_owner, trimmed));
            let model = model;
            let lease = provider.read(
                submit_owner.clone(),
                trimmed.to_owned(),
                Callback::new(move |next| model.set(next)),
            );
            active_lease.set(Some(lease));
            return;
        }
        model.set(partial_search_feed_view(
            &submit_owner,
            trimmed,
            SEARCH_PROVIDER_GAP,
            false,
        ));
    };
    on_cleanup(move || {
        release_current(active_lease);
        release_current(active_older_lease);
    });

    view! {
        <section class="feed-tab lkjstr-search-feed" aria-label="Search">
            <div class="tab-scroll-track event-list__scroller">
                <div class="tab-scroll-owner search-list-scroll" data-scroll-owner="">
                    <form class="lkjstr-search-controls" on:submit=submit>
                        <input
                            type="search"
                            aria-label="Search query"
                            prop:value=move || query.get()
                            on:input=input_query
                        />
                        <button type="submit" prop:disabled=move || query.get().trim().is_empty()>
                            "Search"
                        </button>
                    </form>
                    <p class="lkjstr-feed-status">{move || search_status_text(model.get().status)}</p>
                    <div class="lkjstr-feed-rows">
                        {move || {
                            let command = older_command;
                            let actions = actions.clone();
                            model
                                .get()
                                .view_model
                                .rows
                                .into_iter()
                                .map(move |row| search_row(row, command, actions.clone()))
                                .collect_view()
                        }}
                    </div>
                </div>
            </div>
        </section>
    }
}

#[must_use]
pub fn default_search_feed(tab_id: &str) -> SearchFeedView {
    default_search_feed_view(tab_id)
}

fn release_current(active_lease: RwSignal<Option<SearchFeedLease>>) {
    if let Some(lease) = active_lease.get_untracked() {
        lease.release();
    }
    active_lease.set(None);
}

fn older_command(
    owner: String,
    model: RwSignal<SearchFeedView>,
    provider: Option<SearchFeedProvider>,
    active_older_lease: RwSignal<Option<SearchFeedLease>>,
) -> Option<Callback<()>> {
    provider.and_then(|provider| {
        if !provider.supports_older() {
            return None;
        }
        Some(Callback::new(move |()| {
            release_current(active_older_lease);
            let current = model.get_untracked();
            if !current.window.has_older {
                return;
            }
            let Some(query) = current.submitted_query.clone() else {
                return;
            };
            let lease = provider.load_older(
                owner.clone(),
                query,
                current.window,
                Callback::new(move |next| model.set(next)),
            );
            active_older_lease.set(lease);
        }))
    })
}
