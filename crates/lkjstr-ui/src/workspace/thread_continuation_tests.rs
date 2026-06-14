use leptos::prelude::Callback;

use super::*;

#[test]
fn continuation_action_requires_thread_callback() {
    assert!(!continuation_action_available(&None));
    assert!(continuation_action_available(&Some(Callback::new(
        |_: String| {}
    ))));
}
