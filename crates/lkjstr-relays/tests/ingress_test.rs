use lkjstr_protocol::{
    KIND_EMOJI_SET, KIND_METADATA, KIND_REACTION, KIND_REPOST, KIND_TEXT_NOTE, KIND_ZAP_RECEIPT,
};
use lkjstr_relays::{
    DemandSurface, IngressDecision, ingress_decision, is_feed_display_kind, is_notification_kind,
    is_render_critical_for_surface,
};

#[test]
fn feed_surfaces_accept_only_display_kinds() {
    assert!(is_render_critical_for_surface(
        DemandSurface::Home,
        KIND_TEXT_NOTE
    ));
    assert!(is_render_critical_for_surface(
        DemandSurface::Profile,
        KIND_REPOST
    ));
    assert!(!is_render_critical_for_surface(
        DemandSurface::Global,
        KIND_REACTION
    ));
}

#[test]
fn notifications_accept_notification_related_kinds() {
    assert!(is_notification_kind(KIND_METADATA));
    assert!(is_notification_kind(KIND_REACTION));
    assert!(is_notification_kind(KIND_ZAP_RECEIPT));
    assert!(!is_notification_kind(KIND_EMOJI_SET));
}

#[test]
fn tool_surfaces_accept_requested_events() {
    assert_eq!(
        ingress_decision(DemandSurface::Search, KIND_EMOJI_SET),
        IngressDecision::Accept
    );
    assert_eq!(
        ingress_decision(DemandSurface::CustomRequest, KIND_EMOJI_SET),
        IngressDecision::Accept
    );
}

#[test]
fn non_render_feed_events_are_dropped_with_typed_reason() {
    assert_eq!(
        ingress_decision(DemandSurface::Thread, KIND_REACTION),
        IngressDecision::DropNonRenderCritical
    );
}

#[test]
fn feed_display_helper_matches_feed_policy() {
    assert!(is_feed_display_kind(KIND_TEXT_NOTE));
    assert!(is_feed_display_kind(KIND_REPOST));
    assert!(!is_feed_display_kind(KIND_METADATA));
}
