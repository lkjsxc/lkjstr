use leptos::prelude::*;
use lkjstr_app::profile_npub;
use lkjstr_domain::TabKind;

use crate::workspace::followees::followees_tab_content;
use crate::workspace::followees_actions::FolloweesActions;
use crate::workspace::profile_action_tabs::pubkey_tab_callback;
use crate::workspace::profile_clipboard_provider::{
    ProfileCopyProvider, ProfileCopyResult, ProfileCopyStatus,
};
use crate::workspace::tab_content_input::TabContentInput;

pub(crate) fn followees_open_content(input: TabContentInput) -> impl IntoView {
    let copy_status = RwSignal::new(None::<String>);
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
    let copy_npub = copy_npub_action(input.profile_copy_provider.clone(), copy_status);
    followees_tab_content(
        input.tab_id,
        input.profile_pubkey,
        input.followees_provider,
        FolloweesActions {
            open_profile: Some(open_profile),
            open_user_timeline: Some(open_user_timeline),
            copy_npub,
        },
        Some(copy_status),
    )
}

fn copy_npub_action(
    copy: Option<ProfileCopyProvider>,
    status: RwSignal<Option<String>>,
) -> Option<Callback<String>> {
    copy.map(|copy| {
        Callback::new(move |pubkey: String| {
            let status = status;
            copy.copy(
                "npub".to_owned(),
                profile_npub(&pubkey),
                Callback::new(move |result| {
                    status.set(Some(copy_status_text(result)));
                }),
            );
        })
    })
}

fn copy_status_text(result: ProfileCopyResult) -> String {
    match result.status {
        ProfileCopyStatus::Copied => format!("Copied {}", result.label),
        ProfileCopyStatus::Failed(reason) => format!("Copy failed: {reason}"),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex, MutexGuard};

    use leptos::prelude::{Callable, GetUntracked};

    use super::*;

    #[test]
    fn copy_npub_action_encodes_pubkey_and_reports_completion() -> Result<(), &'static str> {
        let captured = Arc::new(Mutex::new(None::<(String, String)>));
        let captured_provider = captured.clone();
        let provider = ProfileCopyProvider::new(move |command| {
            lock(&captured_provider).replace((command.label.clone(), command.value.clone()));
            command
                .complete
                .complete(ProfileCopyResult::copied(command.label));
        });
        let status = RwSignal::new(None::<String>);
        let action = copy_npub_action(Some(provider), status).ok_or("missing copy action")?;
        let pubkey = "a".repeat(64);

        action.run(pubkey.clone());

        assert_eq!(
            lock(&captured).as_ref(),
            Some(&("npub".to_owned(), profile_npub(&pubkey)))
        );
        assert_eq!(status.get_untracked(), Some("Copied npub".to_owned()));
        Ok(())
    }

    #[test]
    fn copy_status_text_reports_failures() {
        assert_eq!(
            copy_status_text(ProfileCopyResult::failed("npub", "denied")),
            "Copy failed: denied"
        );
    }

    fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
        match mutex.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        }
    }
}
