#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_app::feed::{
    FeedEventContent, FeedEventContentRow, FeedEventMediaAttachment, FeedEventMediaKind,
    FeedEventRow,
};
use lkjstr_app::{
    EventDisplayContext, EventDisplayInput, FeedFooterState, FeedViewModel, FeedViewRow,
    GeometryEstimateSource, HomeFeedStatus, HomeFeedView, RowGeometryEstimate, StartupInput,
    default_recovery_ids, feed_event_row_id, footer_row, plan_event_display,
};
use lkjstr_protocol::KIND_TEXT_NOTE;

pub const MEDIA_ROW_KEY: &str = "home-media-dimension-attachment";

pub fn home_model() -> HomeFeedView {
    HomeFeedView {
        status: HomeFeedStatus::Ready,
        live_query: None,
        view_model: FeedViewModel {
            feed_id: "home-media-dimension".to_owned(),
            rows: vec![
                media_event(),
                text_event(20, "visible anchor event"),
                text_event(10, &"below anchor filler ".repeat(90)),
                FeedViewRow::Footer(footer_row(
                    "home-media-dimension",
                    FeedFooterState::CacheHit,
                )),
            ],
        },
    }
}

pub fn pane_resize_model() -> HomeFeedView {
    HomeFeedView {
        status: HomeFeedStatus::Ready,
        live_query: None,
        view_model: FeedViewModel {
            feed_id: "home-pane-resize".to_owned(),
            rows: vec![
                text_event(40, &pane_resize_text()),
                text_event(20, "visible anchor event"),
                text_event(10, &"below anchor filler ".repeat(90)),
                FeedViewRow::Footer(footer_row("home-pane-resize", FeedFooterState::CacheHit)),
            ],
        },
    }
}

fn pane_resize_text() -> String {
    "pane resize carrier wraps with the split width ".repeat(80)
}

fn media_event() -> FeedViewRow {
    event_row_model(
        30,
        FeedEventContent::Rows(vec![
            FeedEventContentRow::Text("media dimension carrier".to_owned()),
            FeedEventContentRow::MediaAttachment(FeedEventMediaAttachment {
                row_key: MEDIA_ROW_KEY.to_owned(),
                item_index: 0,
                url: "https://cdn.example/home-media-dimension.png".to_owned(),
                kind: FeedEventMediaKind::Image,
                aspect_ratio: None,
            }),
        ]),
    )
}

fn text_event(value: u64, text: &str) -> FeedViewRow {
    event_row_model(
        value,
        FeedEventContent::Rows(vec![FeedEventContentRow::Text(text.to_owned())]),
    )
}

fn event_row_model(value: u64, content: FeedEventContent) -> FeedViewRow {
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
        geometry_estimate: RowGeometryEstimate {
            key: feed_event_row_id(&event_id),
            estimated_height_px: 120,
            confidence: 0.25,
            source: GeometryEstimateSource::FeatureFormula,
        },
        has_content_warning: false,
        content_warning_reason: None,
        custom_emoji_count: 0,
    })
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
