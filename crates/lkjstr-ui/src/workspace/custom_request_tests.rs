use super::*;

#[test]
fn status_text_names_canceled_request() {
    let model = canceled_custom_request_feed_view("tab");

    assert_eq!(
        custom_request_status_text(&model, true),
        "Custom Request canceled."
    );
}

#[test]
fn status_text_names_planning_request() {
    let model = planning_custom_request_feed_view("tab");

    assert_eq!(
        custom_request_status_text(&model, true),
        "Planning Custom Request"
    );
}

#[test]
fn status_text_names_provider_unavailable_row() {
    let model = unavailable_custom_request_feed_view("tab", PROVIDER_UNAVAILABLE, false);

    assert_eq!(
        custom_request_status_text(&model, true),
        PROVIDER_UNAVAILABLE
    );
}

#[test]
fn cancel_button_is_only_available_while_pending() {
    let planning = planning_custom_request_feed_view("tab");
    let idle = default_custom_request_feed_view("tab");

    assert!(can_cancel(&planning));
    assert!(!can_cancel(&idle));
}

#[test]
fn cancel_button_stays_available_for_active_relay_window() {
    let mut active = default_custom_request_feed_view("tab");
    active.status = CustomRequestFeedStatus::Ready;
    active.relays = vec!["wss://selected.example/".to_owned()];

    assert!(can_cancel(&active));
    active.window.terminal = true;
    assert!(!can_cancel(&active));
}
