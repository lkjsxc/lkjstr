#![doc = "Pure render-critical ingress classification."]

use lkjstr_protocol::{
    KIND_GENERIC_REPOST, KIND_METADATA, KIND_REACTION, KIND_REPOST, KIND_TEXT_NOTE,
    KIND_ZAP_RECEIPT,
};

use crate::DemandSurface;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum IngressDecision {
    Accept,
    DropNonRenderCritical,
}

#[must_use]
pub fn ingress_decision(surface: DemandSurface, kind: u64) -> IngressDecision {
    if is_render_critical_for_surface(surface, kind) {
        IngressDecision::Accept
    } else {
        IngressDecision::DropNonRenderCritical
    }
}

#[must_use]
pub const fn is_render_critical_for_surface(surface: DemandSurface, kind: u64) -> bool {
    match surface {
        DemandSurface::Notifications => is_notification_kind(kind),
        DemandSurface::Home
        | DemandSurface::Global
        | DemandSurface::Profile
        | DemandSurface::UserTimeline
        | DemandSurface::Thread => is_feed_display_kind(kind),
        DemandSurface::Search | DemandSurface::CustomRequest | DemandSurface::AuthorContext => true,
    }
}

#[must_use]
pub const fn is_feed_display_kind(kind: u64) -> bool {
    matches!(kind, KIND_TEXT_NOTE | KIND_REPOST | KIND_GENERIC_REPOST)
}

#[must_use]
pub const fn is_notification_kind(kind: u64) -> bool {
    matches!(
        kind,
        KIND_METADATA
            | KIND_TEXT_NOTE
            | KIND_REPOST
            | KIND_REACTION
            | KIND_GENERIC_REPOST
            | KIND_ZAP_RECEIPT
    )
}
