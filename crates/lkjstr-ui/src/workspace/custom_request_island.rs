use leptos::prelude::*;
use leptos::web_sys::HtmlElement;

use crate::workspace::custom_request::CustomRequestTab;
use crate::workspace::custom_request_provider::CustomRequestProvider;
use crate::workspace::custom_request_snapshot::CustomRequestSnapshotHandle;
use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;

pub fn mount_custom_request_island(
    parent: HtmlElement,
    owner: String,
    restored_input: String,
    restored_ran: bool,
    provider: CustomRequestProvider,
    actions: CustomRequestIslandActions,
    save_state: Callback<(String, bool)>,
) -> impl FnMut() + 'static {
    let snapshot = CustomRequestSnapshotHandle::callback(restored_input, restored_ran, save_state);
    let actions = FeedEventActions::row_actions(
        actions.open_profile,
        actions.open_thread,
        actions.open_author_context,
        actions.copy_event_id,
    );
    let handle = leptos::mount::mount_to(parent, move || {
        view! {
            <CustomRequestTab
                owner=owner.clone()
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
pub struct CustomRequestIslandActions {
    pub open_profile: Option<Callback<String>>,
    pub open_thread: Option<Callback<String>>,
    pub open_author_context: Option<Callback<(String, String)>>,
    pub copy_event_id: Option<ProfileCopyProvider>,
}
