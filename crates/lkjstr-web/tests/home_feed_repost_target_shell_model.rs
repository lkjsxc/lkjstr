#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_app::feed::{
    FeedEventContent, FeedEventContentRow, FeedEventRepostTarget, FeedEventRepostTargetShell,
    FeedEventRow, feed_repost_target_row_id,
};
use lkjstr_app::{
    EventDisplayContext, EventDisplayInput, FeedFooterState, FeedViewModel, FeedViewRow,
    GeometryEstimateSource, HomeFeedStatus, HomeFeedView, RowGeometryEstimate, StartupInput,
    default_recovery_ids, feed_event_row_id, footer_row, plan_event_display,
    plan_repost_target_display,
};
use lkjstr_protocol::KIND_TEXT_NOTE;

pub const SOURCE_EVENT_VALUE: u64 = 40;
pub const ANCHOR_EVENT_VALUE: u64 = 20;
const TARGET_EVENT_VALUE: u64 = 41;

pub fn repost_target_row_key() -> String {
    feed_repost_target_row_id(&id(SOURCE_EVENT_VALUE), &id(TARGET_EVENT_VALUE))
}

pub fn initial_model() -> HomeFeedView {
    model(source_event(false, 0))
}

pub fn dematerialized_model(reserved_height_px: u16) -> HomeFeedView {
    model(source_event(true, reserved_height_px))
}

fn model(source: FeedViewRow) -> HomeFeedView {
    HomeFeedView {
        status: HomeFeedStatus::Ready,
        live_query: None,
        view_model: FeedViewModel {
            feed_id: "home-repost-target-shell".to_owned(),
            rows: vec![
                source,
                text_event(ANCHOR_EVENT_VALUE, "visible anchor event"),
                text_event(10, &"below repost target shell filler ".repeat(90)),
                FeedViewRow::Footer(footer_row(
                    "home-repost-target-shell",
                    FeedFooterState::CacheHit,
                )),
            ],
        },
    }
}

fn source_event(shell: bool, reserved_height_px: u16) -> FeedViewRow {
    let rows = if shell {
        vec![
            FeedEventContentRow::Text("source repost wrapper".to_owned()),
            FeedEventContentRow::RepostTargetShell(target_shell(reserved_height_px)),
        ]
    } else {
        vec![
            FeedEventContentRow::Text("source repost wrapper".to_owned()),
            FeedEventContentRow::RepostTarget(target_row()),
        ]
    };
    event_with_content(SOURCE_EVENT_VALUE, FeedEventContent::Rows(rows))
}

fn target_row() -> FeedEventRepostTarget {
    FeedEventRepostTarget {
        row_key: repost_target_row_key(),
        event_id: id(TARGET_EVENT_VALUE),
        author_pubkey: pubkey("c"),
        created_at: 1_700_000_000 + TARGET_EVENT_VALUE,
        display: plan_repost_target_display(
            Some(id(TARGET_EVENT_VALUE)),
            Some("target-shape".to_owned()),
            true,
        ),
        content: FeedEventContent::Rows(vec![FeedEventContentRow::Text(
            "reposted target carrier preserves measured height ".repeat(10),
        )]),
        geometry_estimate: estimate(repost_target_row_key(), 180),
        has_content_warning: false,
        content_warning_reason: None,
    }
}

fn target_shell(reserved_height_px: u16) -> FeedEventRepostTargetShell {
    FeedEventRepostTargetShell {
        row_key: repost_target_row_key(),
        event_id: id(TARGET_EVENT_VALUE),
        reserved_height_px,
    }
}

fn text_event(value: u64, text: &str) -> FeedViewRow {
    event_with_content(
        value,
        FeedEventContent::Rows(vec![FeedEventContentRow::Text(text.to_owned())]),
    )
}

fn event_with_content(value: u64, content: FeedEventContent) -> FeedViewRow {
    let event_id = id(value);
    FeedViewRow::Event(FeedEventRow {
        row_id: feed_event_row_id(&event_id),
        event_id: event_id.clone(),
        author_pubkey: pubkey("b"),
        created_at: 1_700_000_000 + value,
        event_kind: KIND_TEXT_NOTE,
        relay_provenance: vec!["wss://selected.example".to_owned()],
        display: plan_event_display(&EventDisplayInput {
            event_id: Some(event_id.clone()),
            event_kind: Some(KIND_TEXT_NOTE),
            content_shape_hash: Some(format!("shape-{value}")),
            context: EventDisplayContext::Timeline,
            target_available: true,
        }),
        content,
        geometry_estimate: estimate(feed_event_row_id(&event_id), 120),
        has_content_warning: false,
        content_warning_reason: None,
        custom_emoji_count: 0,
    })
}

fn estimate(key: String, estimated_height_px: u16) -> RowGeometryEstimate {
    RowGeometryEstimate {
        key,
        estimated_height_px,
        confidence: 0.25,
        source: GeometryEstimateSource::FeatureFormula,
    }
}

pub fn startup() -> StartupInput {
    StartupInput {
        stored_workspace: None,
        storage_available: true,
        tab_snapshots: Vec::new(),
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
