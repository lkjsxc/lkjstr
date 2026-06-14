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
fn status_text_names_provider_gap_row() {
    let model = unavailable_custom_request_feed_view("tab", PROVIDER_GAP, false);

    assert_eq!(custom_request_status_text(&model, true), PROVIDER_GAP);
}

#[test]
fn cancel_button_is_only_available_while_pending() {
    assert!(can_cancel(CustomRequestFeedStatus::Planning));
    assert!(!can_cancel(CustomRequestFeedStatus::Ready));
}
