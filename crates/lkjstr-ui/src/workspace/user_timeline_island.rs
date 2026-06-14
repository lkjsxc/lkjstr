use leptos::prelude::*;
use leptos::web_sys::HtmlElement;
use lkjstr_app::default_user_timeline_feed_view;

use crate::workspace::user_timeline::UserTimelineTab;
use crate::workspace::user_timeline_actions::UserTimelineActions;
use crate::workspace::user_timeline_provider::UserTimelineProvider;

pub fn mount_user_timeline_island(
    parent: HtmlElement,
    owner: String,
    target_pubkey: Option<String>,
    provider: UserTimelineProvider,
    actions: UserTimelineIslandActions,
) -> impl FnMut() + 'static {
    let model = default_user_timeline_feed_view(&owner, target_pubkey.clone());
    let actions = UserTimelineActions {
        open_profile: actions.open_profile,
        open_thread: actions.open_thread,
        open_author_context: actions.open_author_context,
        copy_event_id: actions.copy_event_id,
    };
    let handle = leptos::mount::mount_to(parent, move || {
        view! {
            <UserTimelineTab
                owner=owner.clone()
                target_pubkey=target_pubkey.clone()
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
pub struct UserTimelineIslandActions {
    pub open_profile: Option<Callback<String>>,
    pub open_thread: Option<Callback<String>>,
    pub open_author_context: Option<Callback<(String, String)>>,
    pub copy_event_id: Option<crate::workspace::profile_clipboard_provider::ProfileCopyProvider>,
}
