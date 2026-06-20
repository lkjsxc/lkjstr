use lkjstr_app::{
    GeometryEstimateSource, RowGeometryEstimate,
    feed::{
        FeedEventContent, FeedEventContentRow, FeedEventCustomEmoji, FeedEventLink,
        FeedEventMediaAttachment, FeedEventMediaKind, FeedEventProfileMention,
        FeedEventReferenceKind, FeedEventReferenceUnavailable, FeedEventRepostTarget,
        FeedEventRepostTargetShell, FeedEventUnavailablePreview,
    },
    plan_repost_target_display,
};

use super::*;

#[test]
fn content_row_render_plan_preserves_payloads_and_openers() {
    let link = FeedEventLink {
        row_key: "event:e:shape:s:kind:event-link:index:0".to_owned(),
        item_index: 0,
        url: "https://example.com".to_owned(),
        text: "https://example.com".to_owned(),
    };
    let mention = FeedEventProfileMention {
        row_key: "event:e:shape:s:kind:event-profile-mention:index:1".to_owned(),
        item_index: 1,
        pubkey: "a".repeat(64),
        relays: vec!["wss://relay.example/".to_owned()],
        raw_text: "nostr:npub1example".to_owned(),
    };
    let emoji = FeedEventCustomEmoji {
        row_key: "event:e:shape:s:kind:event-custom-emoji:index:2".to_owned(),
        item_index: 2,
        shortcode: "party".to_owned(),
        url: "https://emoji.example/party.png".to_owned(),
        address: Some(format!("30030:{}:set", "b".repeat(64))),
    };
    let media = FeedEventMediaAttachment {
        row_key: "event:e:shape:s:kind:event-media-attachment:index:3".to_owned(),
        item_index: 3,
        url: "https://cdn.example/image.png".to_owned(),
        kind: FeedEventMediaKind::Image,
        aspect_ratio: Some("4 / 3".to_owned()),
    };
    let target = repost_target();
    let shell = FeedEventRepostTargetShell {
        row_key: "event:e:repost-target-shell:t".to_owned(),
        event_id: "t".to_owned(),
        reserved_height_px: 148,
    };
    let preview = FeedEventUnavailablePreview {
        row_key: "event:e:shape:s:event-media-segment:4".to_owned(),
        segment_index: 4,
    };
    let reference = FeedEventReferenceUnavailable {
        row_key: "event:e:shape:s:kind:event-reference:index:5".to_owned(),
        segment_index: 5,
        event_id: "c".repeat(64),
        kind: FeedEventReferenceKind::Quote,
        relays: vec!["wss://relay.example/".to_owned()],
    };

    let cases = vec![
        (
            FeedEventContentRow::Text("hello".to_owned()),
            FeedEventContentRowRenderPlan::Text("hello".to_owned()),
            FeedEventContentRowOpeners::NONE,
        ),
        (
            FeedEventContentRow::Link(link.clone()),
            FeedEventContentRowRenderPlan::Link(link),
            FeedEventContentRowOpeners::NONE,
        ),
        (
            FeedEventContentRow::ProfileMention(mention.clone()),
            FeedEventContentRowRenderPlan::ProfileMention(mention),
            FeedEventContentRowOpeners::PROFILE,
        ),
        (
            FeedEventContentRow::CustomEmoji(emoji.clone()),
            FeedEventContentRowRenderPlan::CustomEmoji(emoji),
            FeedEventContentRowOpeners::NONE,
        ),
        (
            FeedEventContentRow::MediaAttachment(media.clone()),
            FeedEventContentRowRenderPlan::MediaAttachment(media),
            FeedEventContentRowOpeners::NONE,
        ),
        (
            FeedEventContentRow::RepostTarget(target.clone()),
            FeedEventContentRowRenderPlan::RepostTarget(target),
            FeedEventContentRowOpeners::PROFILE_AND_THREAD,
        ),
        (
            FeedEventContentRow::RepostTargetShell(shell.clone()),
            FeedEventContentRowRenderPlan::RepostTargetShell(shell),
            FeedEventContentRowOpeners::NONE,
        ),
        (
            FeedEventContentRow::MediaPreviewUnavailable(preview.clone()),
            FeedEventContentRowRenderPlan::MediaPreviewUnavailable(preview.clone()),
            FeedEventContentRowOpeners::NONE,
        ),
        (
            FeedEventContentRow::ReferenceUnavailable(reference.clone()),
            FeedEventContentRowRenderPlan::ReferenceUnavailable(reference),
            FeedEventContentRowOpeners::THREAD,
        ),
        (
            FeedEventContentRow::ReferencePreviewUnavailable(preview.clone()),
            FeedEventContentRowRenderPlan::ReferencePreviewUnavailable(preview),
            FeedEventContentRowOpeners::NONE,
        ),
    ];

    for (row, expected, openers) in cases {
        let plan = content_row_render_plan(row);
        assert_eq!(plan, expected);
        assert_eq!(plan.openers(), openers);
    }
}

fn repost_target() -> FeedEventRepostTarget {
    FeedEventRepostTarget {
        row_key: "event:e:repost-target:t".to_owned(),
        event_id: "t".to_owned(),
        author_pubkey: "d".repeat(64),
        created_at: 42,
        display: plan_repost_target_display(Some("t".to_owned()), Some("s".to_owned()), true),
        content: FeedEventContent::Rows(Vec::new()),
        geometry_estimate: RowGeometryEstimate {
            key: "event:e:repost-target:t".to_owned(),
            estimated_height_px: 148,
            confidence: 0.25,
            source: GeometryEstimateSource::FeatureFormula,
        },
        has_content_warning: false,
        content_warning_reason: None,
    }
}
