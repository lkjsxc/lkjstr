use leptos::prelude::Callback;

use super::following_count_opens;

#[test]
fn following_count_button_requires_known_count_and_callback() {
    let callback = Some(Callback::new(|_: String| {}));

    assert!(following_count_opens(true, &callback));
    assert!(!following_count_opens(false, &callback));
    assert!(!following_count_opens(true, &None));
}
