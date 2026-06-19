use leptos::prelude::*;
use leptos::web_sys::HtmlElement;

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::profile::{ProfileActions, profile_tab_content};
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::profile_follow_provider::ProfileFollowProvider;
use crate::workspace::profile_provider::ProfileFeedProvider;

pub fn mount_profile_island(
    parent: HtmlElement,
    owner: String,
    profile_pubkey: Option<String>,
    provider: ProfileFeedProvider,
    actions: ProfileIslandActions,
) -> impl FnMut() + 'static {
    let profile_actions = ProfileActions {
        active_account_pubkey: actions.active_account_pubkey,
        open_followees: actions.open_followees,
        open_user_timeline: actions.open_user_timeline,
        open_profile_edit: actions.open_profile_edit,
        copy_profile: actions.copy_profile,
        follow_profile: actions.follow_profile,
        event_actions: FeedEventActions::row_actions(
            actions.open_profile,
            actions.open_thread,
            actions.open_author_context,
            actions.copy_event_id,
        ),
    };
    let handle = leptos::mount::mount_to(parent, move || {
        profile_tab_content(
            owner.clone(),
            profile_pubkey.clone(),
            None,
            Some(provider.clone()),
            profile_actions.clone(),
        )
    });
    let mut handle = Some(handle);
    move || {
        drop(handle.take());
    }
}

#[derive(Clone)]
pub struct ProfileIslandActions {
    pub active_account_pubkey: Option<String>,
    pub open_profile: Option<Callback<String>>,
    pub open_followees: Option<Callback<String>>,
    pub open_user_timeline: Option<Callback<String>>,
    pub open_profile_edit: Option<Callback<()>>,
    pub open_thread: Option<Callback<String>>,
    pub open_author_context: Option<Callback<(String, String)>>,
    pub copy_profile: Option<ProfileCopyProvider>,
    pub copy_event_id: Option<ProfileCopyProvider>,
    pub follow_profile: Option<ProfileFollowProvider>,
}
