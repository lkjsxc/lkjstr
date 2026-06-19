use lkjstr_app::{
    GeometryEstimateSource, RowGeometryEstimate,
    feed::{FeedEventContent, FeedEventRepostTarget, FeedEventRepostTargetShell},
    plan_repost_target_display,
};

use super::*;

#[test]
fn repost_target_attrs_keep_verified_target_identity() {
    let attrs = repost_target_attrs(&FeedEventRepostTarget {
        row_key: "event:source:repost-target:target".to_owned(),
        event_id: "target".to_owned(),
        author_pubkey: "a".repeat(64),
        created_at: 42,
        display: plan_repost_target_display(
            Some("target".to_owned()),
            Some("shape".to_owned()),
            true,
        ),
        content: FeedEventContent::Rows(Vec::new()),
        geometry_estimate: RowGeometryEstimate {
            key: "event:source:repost-target:target".to_owned(),
            estimated_height_px: 148,
            confidence: 0.25,
            source: GeometryEstimateSource::FeatureFormula,
        },
        has_content_warning: false,
        content_warning_reason: None,
    });

    assert_eq!(
        attrs,
        RepostTargetAttrs {
            row_key: "event:source:repost-target:target".to_owned(),
            event_id: "target".to_owned(),
            label: "aaaaaaaa...aaaaaaaa created 42".to_owned(),
            geometry_context: "shared-event:repost-target",
            estimated_height: "148".to_owned(),
        }
    );
}

#[test]
fn repost_target_shell_attrs_keep_reserved_identity() {
    let attrs = repost_target_shell_attrs(&FeedEventRepostTargetShell {
        row_key: "event:source:repost-target:target".to_owned(),
        event_id: "target".to_owned(),
        reserved_height_px: 184,
    });

    assert_eq!(
        attrs,
        RepostTargetShellAttrs {
            row_key: "event:source:repost-target:target".to_owned(),
            event_id: "target".to_owned(),
            reserved_height: "184".to_owned(),
            style: "min-height:184px;".to_owned(),
        }
    );
}
