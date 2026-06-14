use leptos::prelude::Callback;

use super::*;

#[test]
fn copy_event_status_text_names_success_and_failure() {
    assert_eq!(
        copy_event_status_text(ProfileCopyResult::copied("event id")),
        "Copied"
    );
    assert_eq!(
        copy_event_status_text(ProfileCopyResult::failed("event id", "denied")),
        "Copy failed: denied"
    );
}

#[test]
fn feed_event_actions_available_requires_at_least_one_action() {
    assert!(!feed_event_actions_available(&FeedEventActions::default()));
    assert!(feed_event_actions_available(&FeedEventActions {
        open_profile: Some(Callback::new(|_: String| {})),
        ..FeedEventActions::default()
    }));
}

#[test]
fn nearby_actions_are_available_when_any_provider_exists() {
    assert!(feed_event_actions_available(&FeedEventActions::nearby(
        Some(Callback::new(|_: (String, String)| {})),
        None,
    )));
}

#[test]
fn nearby_copy_provider_alone_keeps_menu_available() {
    assert!(feed_event_actions_available(&FeedEventActions::nearby(
        None,
        Some(ProfileCopyProvider::unavailable()),
    )));
}

#[test]
fn author_context_actions_convert_all_real_providers() {
    let actions = FeedEventActions::from(AuthorContextActions {
        open_profile: Some(Callback::new(|_: String| {})),
        open_thread: Some(Callback::new(|_: String| {})),
        open_author_context: Some(Callback::new(|_: (String, String)| {})),
        copy_event_id: Some(ProfileCopyProvider::unavailable()),
    });

    assert!(actions.open_profile.is_some());
    assert!(actions.open_thread.is_some());
    assert!(actions.open_author_context.is_some());
    assert!(actions.copy_event_id.is_some());
    assert!(feed_event_actions_available(&actions));
}

#[test]
fn user_timeline_actions_convert_all_real_providers() {
    let actions = FeedEventActions::from(UserTimelineActions {
        open_profile: Some(Callback::new(|_: String| {})),
        open_thread: Some(Callback::new(|_: String| {})),
        open_author_context: Some(Callback::new(|_: (String, String)| {})),
        copy_event_id: Some(ProfileCopyProvider::unavailable()),
    });

    assert!(actions.open_profile.is_some());
    assert!(actions.open_thread.is_some());
    assert!(actions.open_author_context.is_some());
    assert!(actions.copy_event_id.is_some());
    assert!(feed_event_actions_available(&actions));
}
