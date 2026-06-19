use leptos::prelude::*;
use leptos::web_sys::HtmlElement;

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::notifications::{NotificationsTab, default_notifications_feed};
use crate::workspace::notifications_provider::NotificationsFeedProvider;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;

pub fn mount_notifications_island(
    parent: HtmlElement,
    owner: String,
    active_pubkey: Option<String>,
    provider: NotificationsFeedProvider,
    actions: NotificationsIslandActions,
) -> impl FnMut() + 'static {
    let model = default_notifications_feed(&owner, active_pubkey);
    let actions = FeedEventActions::row_actions(
        actions.open_profile,
        actions.open_thread,
        actions.open_author_context,
        actions.copy_event_id,
    );
    let handle = leptos::mount::mount_to(parent, move || {
        view! {
            <NotificationsTab
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
pub struct NotificationsIslandActions {
    pub open_profile: Option<Callback<String>>,
    pub open_thread: Option<Callback<String>>,
    pub open_author_context: Option<Callback<(String, String)>>,
    pub copy_event_id: Option<ProfileCopyProvider>,
}
