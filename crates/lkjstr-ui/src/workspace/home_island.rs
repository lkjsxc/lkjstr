use leptos::prelude::*;
use leptos::web_sys::HtmlElement;

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::home::{HomeTab, default_home_feed};
use crate::workspace::home_provider::HomeFeedProvider;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;

pub fn mount_home_island(
    parent: HtmlElement,
    owner: String,
    active_pubkey: Option<String>,
    provider: HomeFeedProvider,
    actions: HomeIslandActions,
) -> impl FnMut() + 'static {
    let model = default_home_feed(&owner, active_pubkey);
    let actions = FeedEventActions::row_actions(
        actions.open_profile,
        actions.open_thread,
        actions.open_author_context,
        actions.copy_event_id,
    );
    let handle = leptos::mount::mount_to(parent, move || {
        view! {
            <HomeTab
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
pub struct HomeIslandActions {
    pub open_profile: Option<Callback<String>>,
    pub open_thread: Option<Callback<String>>,
    pub open_author_context: Option<Callback<(String, String)>>,
    pub copy_event_id: Option<ProfileCopyProvider>,
}
