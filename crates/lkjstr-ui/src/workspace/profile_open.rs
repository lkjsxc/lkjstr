use leptos::prelude::*;
use lkjstr_domain::TabKind;

use crate::workspace::feed_event_open::nearby_event_actions;
use crate::workspace::profile::{self, ProfileActions};
use crate::workspace::profile_action_tabs::{kind_callback, pubkey_tab_callback};
use crate::workspace::tab_content_input::TabContentInput;

pub(crate) fn profile_tab_content(input: TabContentInput) -> impl IntoView {
    let open_followees = pubkey_tab_callback(
        input.runtime,
        input.sequence,
        input.pane_id.clone(),
        input.persistence.clone(),
        TabKind::Followees,
    );
    let open_user_timeline = pubkey_tab_callback(
        input.runtime,
        input.sequence,
        input.pane_id.clone(),
        input.persistence.clone(),
        TabKind::UserTimeline,
    );
    let open_profile_edit = kind_callback(
        input.runtime,
        input.sequence,
        input.pane_id.clone(),
        input.persistence.clone(),
        TabKind::ProfileEdit,
    );
    let event_actions = nearby_event_actions(
        input.runtime,
        input.sequence,
        input.pane_id.clone(),
        input.persistence.clone(),
        input.profile_copy_provider.clone(),
    );
    profile::profile_tab_content(
        input.tab_id,
        input.profile_pubkey,
        input.profile_feed,
        input.profile_feed_provider,
        ProfileActions {
            active_account_pubkey: input.active_account_pubkey,
            open_followees: Some(open_followees),
            open_user_timeline: Some(open_user_timeline),
            open_profile_edit: Some(open_profile_edit),
            copy_profile: input.profile_copy_provider,
            follow_profile: input.profile_follow_provider,
            event_actions,
        },
    )
}
