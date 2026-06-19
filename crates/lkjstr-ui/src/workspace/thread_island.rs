use leptos::prelude::*;
use leptos::web_sys::HtmlElement;

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::thread::{ThreadTab, default_thread_feed};
use crate::workspace::thread_provider::ThreadFeedProvider;

pub fn mount_thread_island(
    parent: HtmlElement,
    owner: String,
    event_id: Option<String>,
    provider: ThreadFeedProvider,
    actions: ThreadIslandActions,
) -> impl FnMut() + 'static {
    let model = default_thread_feed(&owner, event_id.clone());
    let open_thread = actions.open_thread;
    let actions = FeedEventActions::row_actions(
        actions.open_profile,
        actions.open_thread,
        actions.open_author_context,
        actions.copy_event_id,
    );
    let handle = leptos::mount::mount_to(parent, move || {
        view! {
            <ThreadTab
                owner=owner.clone()
                event_id=event_id.clone()
                model=model.clone()
                provider=Some(provider.clone())
                open_thread=open_thread
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
pub struct ThreadIslandActions {
    pub open_profile: Option<Callback<String>>,
    pub open_thread: Option<Callback<String>>,
    pub open_author_context: Option<Callback<(String, String)>>,
    pub copy_event_id: Option<ProfileCopyProvider>,
}
