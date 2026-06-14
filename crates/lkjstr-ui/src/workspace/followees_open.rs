use leptos::prelude::*;
use lkjstr_domain::TabKind;

use crate::workspace::followees::followees_tab_content;
use crate::workspace::followees_actions::FolloweesActions;
use crate::workspace::profile_action_tabs::pubkey_tab_callback;
use crate::workspace::tab_content_input::TabContentInput;

pub(crate) fn followees_open_content(input: TabContentInput) -> impl IntoView {
    let open_profile = pubkey_tab_callback(
        input.runtime,
        input.sequence,
        input.pane_id.clone(),
        input.persistence.clone(),
        TabKind::Profile,
    );
    let open_user_timeline = pubkey_tab_callback(
        input.runtime,
        input.sequence,
        input.pane_id.clone(),
        input.persistence.clone(),
        TabKind::UserTimeline,
    );
    followees_tab_content(
        input.tab_id,
        input.profile_pubkey,
        input.followees_provider,
        FolloweesActions {
            open_profile: Some(open_profile),
            open_user_timeline: Some(open_user_timeline),
            copy_npub: None,
        },
    )
}
