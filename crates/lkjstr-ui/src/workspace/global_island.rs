use leptos::prelude::*;
use leptos::web_sys::HtmlElement;

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::global::{GlobalTab, default_global_feed};
use crate::workspace::global_provider::GlobalFeedProvider;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;

pub fn mount_global_island(
    parent: HtmlElement,
    owner: String,
    provider: GlobalFeedProvider,
    actions: GlobalIslandActions,
) -> impl FnMut() + 'static {
    let model = default_global_feed(&owner);
    let actions = FeedEventActions::row_actions(
        actions.open_profile,
        actions.open_thread,
        actions.open_author_context,
        actions.copy_event_id,
    );
    let handle = leptos::mount::mount_to(parent, move || {
        view! {
            <GlobalTab
                owner=owner.clone()
                model=model.clone()
                provider=Some(provider.clone())
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
pub struct GlobalIslandActions {
    pub open_profile: Option<Callback<String>>,
    pub open_thread: Option<Callback<String>>,
    pub open_author_context: Option<Callback<(String, String)>>,
    pub copy_event_id: Option<ProfileCopyProvider>,
}
