use crate::{
    EventDisplayContext,
    feed_fragments::{FeedFragmentConfig, SemanticFeedEvent},
    feed_geometry::{RowGeometryModel, RowKind, estimate_row_geometry},
};
use lkjstr_protocol::{
    NostrEvent, content_warning_reason, custom_emojis, embedded_media_attachments,
    event_references, verified_nested_repost,
};

use super::{
    FeedEventRepostTarget,
    content::plan_feed_event_content_without_repost_target,
    feed_repost_target_row_id,
    geometry::{feed_event_display, feed_event_geometry_features_for_row},
};

pub(crate) fn verified_repost_target_row(
    source: &NostrEvent,
    width_px: u16,
    font_scale: f32,
    models: &[RowGeometryModel],
    config: &FeedFragmentConfig,
) -> Option<FeedEventRepostTarget> {
    let target = verified_nested_repost(source)?;
    let display = feed_event_display(&target, EventDisplayContext::RepostTarget);
    let features = feed_event_geometry_features_for_row(
        &target,
        RowKind::RepostTarget,
        width_px,
        font_scale,
        display.chrome.show_actions,
    );
    let row_key = feed_repost_target_row_id(&source.id, &target.id);
    let geometry_estimate = estimate_row_geometry(row_key.clone(), &features, models);
    let content_warning_reason = content_warning_reason(&target);
    let custom_emojis = custom_emojis(&target);
    let media_attachments = embedded_media_attachments(&target);
    let event_references = event_references(&target);
    let content = plan_feed_event_content_without_repost_target(
        features.has_content_warning,
        content_warning_reason.clone(),
        &SemanticFeedEvent {
            event_id: target.id.clone(),
            event_kind: target.kind,
            pubkey: target.pubkey.clone(),
            created_at: target.created_at,
            content: target.content.clone(),
            media_count: media_attachments.len().min(usize::from(u16::MAX)) as u16,
            media_attachments,
            reference_count: event_references.len().min(usize::from(u16::MAX)) as u16,
            event_references,
            relay_provenance: Vec::new(),
            has_action_bar: display.chrome.show_actions,
        },
        &custom_emojis,
        &features.content_shape_hash,
        geometry_estimate.estimated_height_px,
        config,
    );
    Some(FeedEventRepostTarget {
        row_key,
        event_id: target.id,
        author_pubkey: target.pubkey,
        created_at: target.created_at,
        display,
        content,
        geometry_estimate,
        has_content_warning: features.has_content_warning,
        content_warning_reason,
    })
}
