use leptos::prelude::Callback;

use super::{following_count_opens, profile_website_link_rel};

#[test]
fn following_count_button_requires_known_count_and_callback() {
    let callback = Some(Callback::new(|_: String| {}));

    assert!(following_count_opens(true, &callback));
    assert!(!following_count_opens(false, &callback));
    assert!(!following_count_opens(true, &None));
}

#[test]
fn website_link_uses_safe_external_policy() {
    assert_eq!(profile_website_link_rel(), "noopener noreferrer");
}
