use leptos::prelude::Callback;

use super::*;

#[test]
fn copy_event_status_text_names_success_and_failure() {
    assert_eq!(
        copy_event_status_text(ProfileCopyResult::copied("event id")),
        "Copied event id"
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
