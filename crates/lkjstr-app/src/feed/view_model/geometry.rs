use std::collections::BTreeSet;

use lkjstr_protocol::NostrEvent;

use crate::{
    EventDisplayContext, EventDisplayInput, EventDisplayPlan, FeedWindowState,
    feed_geometry::{
        MaterializationTier, RowGeometryFeatures, RowKind, event_geometry_features,
        geometry_bucket_key,
    },
    plan_event_display,
};

#[must_use]
pub fn feed_event_geometry_model_keys(
    window: &FeedWindowState,
    context: EventDisplayContext,
    width_px: u16,
    font_scale: f32,
) -> Vec<String> {
    let mut keys = BTreeSet::new();
    for event in window.visible_events() {
        let features = feed_event_geometry_features(&event.event, context, width_px, font_scale);
        keys.insert(geometry_bucket_key(&features));
    }
    keys.into_iter().collect()
}

pub(crate) fn feed_event_display(
    event: &NostrEvent,
    context: EventDisplayContext,
) -> EventDisplayPlan {
    plan_event_display(&EventDisplayInput {
        event_id: Some(event.id.clone()),
        event_kind: Some(event.kind),
        content_shape_hash: None,
        context,
        target_available: true,
    })
}

pub(crate) fn feed_event_geometry_features(
    event: &NostrEvent,
    context: EventDisplayContext,
    width_px: u16,
    font_scale: f32,
) -> RowGeometryFeatures {
    let display = feed_event_display(event, context);
    feed_event_geometry_features_with_actions(
        event,
        width_px,
        font_scale,
        display.chrome.show_actions,
    )
}

pub(crate) fn feed_event_geometry_features_with_actions(
    event: &NostrEvent,
    width_px: u16,
    font_scale: f32,
    has_action_bar: bool,
) -> RowGeometryFeatures {
    event_geometry_features(
        event,
        RowKind::Event,
        width_px,
        font_scale,
        false,
        has_action_bar,
        MaterializationTier::Enriched,
    )
}
