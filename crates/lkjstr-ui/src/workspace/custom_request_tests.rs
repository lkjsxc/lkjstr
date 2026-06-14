use super::*;

#[test]
fn status_text_names_canceled_request() {
    assert_eq!(
        status_text(false, false, true, true, None),
        "Custom Request canceled."
    );
}

#[test]
fn pending_state_takes_precedence_over_canceled_state() {
    assert_eq!(
        status_text(true, false, true, true, None),
        "Planning Custom Request"
    );
}

#[test]
fn provider_gap_takes_precedence_over_canceled_state() {
    assert_eq!(status_text(false, true, true, true, None), PROVIDER_GAP);
}

#[test]
fn cancel_button_is_only_available_while_pending() {
    assert!(can_cancel(true));
    assert!(!can_cancel(false));
}
