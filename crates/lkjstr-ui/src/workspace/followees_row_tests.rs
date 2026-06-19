use leptos::prelude::Callback;

use super::*;

#[test]
fn followee_display_name_uses_unknown_until_metadata_is_real() {
    assert_eq!(followee_display_name(None), "Unknown");
    assert_eq!(followee_display_name(Some(" ".to_owned())), "Unknown");
    assert_eq!(
        followee_display_name(Some("Rust Friend".to_owned())),
        "Rust Friend"
    );
}

#[test]
fn followee_overflow_excludes_primary_profile_action() {
    let actions = FolloweesActions {
        open_profile: Some(Callback::new(|_: String| {})),
        open_user_timeline: None,
        copy_npub: None,
    };

    assert!(!followee_overflow_available(&actions));
}

#[test]
fn followee_profile_available_requires_profile_action() {
    assert!(!followee_profile_available(&FolloweesActions::default()));
    assert!(followee_profile_available(&FolloweesActions {
        open_profile: Some(Callback::new(|_: String| {})),
        ..FolloweesActions::default()
    }));
}

#[test]
fn followee_overflow_keeps_secondary_actions() {
    let actions = FolloweesActions {
        open_profile: None,
        open_user_timeline: Some(Callback::new(|_: String| {})),
        copy_npub: Some(Callback::new(|_: String| {})),
    };

    assert!(followee_overflow_available(&actions));
}
