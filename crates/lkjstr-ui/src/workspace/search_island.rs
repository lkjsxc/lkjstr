use leptos::prelude::*;
use leptos::web_sys::HtmlElement;
use lkjstr_app::default_search_feed_view;

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::search::SearchTab;
use crate::workspace::search_provider::SearchFeedProvider;
use crate::workspace::search_snapshot::SearchSnapshotHandle;

pub fn mount_search_island(
    parent: HtmlElement,
    owner: String,
    restored_query: String,
    provider: SearchFeedProvider,
    actions: SearchIslandActions,
    save_query: Callback<String>,
) -> impl FnMut() + 'static {
    let model = default_search_feed_view(&owner);
    let snapshot = SearchSnapshotHandle::callback(restored_query, save_query);
    let actions = FeedEventActions::row_actions(
        actions.open_profile,
        actions.open_thread,
        actions.open_author_context,
        actions.copy_event_id,
    );
    let handle = leptos::mount::mount_to(parent, move || {
        view! {
            <SearchTab
                owner=owner.clone()
                model=model.clone()
                provider=Some(provider.clone())
                snapshot=snapshot.clone()
                actions=actions.clone()
            />
        }
    });
    let mut handle = Some(handle);
    move || {
        drop(handle.take());
    }
}

#[derive(Clone)]
pub struct SearchIslandActions {
    pub open_profile: Option<Callback<String>>,
    pub open_thread: Option<Callback<String>>,
    pub open_author_context: Option<Callback<(String, String)>>,
    pub copy_event_id: Option<ProfileCopyProvider>,
}
