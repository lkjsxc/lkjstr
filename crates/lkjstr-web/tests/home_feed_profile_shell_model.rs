#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_app::feed::{FeedEventContent, FeedEventContentRow, FeedEventRow};
use lkjstr_app::{
    EventDisplayContext, EventDisplayInput, FeedFooterState, FeedProfileRow, FeedShellRow,
    FeedViewModel, FeedViewRow, GeometryEstimateSource, HomeFeedStatus, HomeFeedView,
    RowGeometryEstimate, StartupInput, default_recovery_ids, feed_event_row_id,
    feed_profile_row_id, footer_row, plan_event_display,
};
use lkjstr_protocol::KIND_TEXT_NOTE;

pub const ANCHOR_EVENT_VALUE: u64 = 20;

pub fn profile_row_id() -> String {
    feed_profile_row_id(&profile_pubkey())
}

pub fn initial_model() -> HomeFeedView {
    HomeFeedView {
        status: HomeFeedStatus::Ready,
        live_query: None,
        view_model: FeedViewModel {
            feed_id: "home-profile-shell".to_owned(),
            rows: vec![
                profile_row(),
                text_event(ANCHOR_EVENT_VALUE, "visible anchor event"),
                text_event(10, &"below profile shell filler ".repeat(90)),
                FeedViewRow::Footer(footer_row("home-profile-shell", FeedFooterState::CacheHit)),
            ],
        },
    }
}

pub fn dematerialized_model(reserved_height_px: u16) -> HomeFeedView {
    HomeFeedView {
        status: HomeFeedStatus::Ready,
        live_query: None,
        view_model: FeedViewModel {
            feed_id: "home-profile-shell".to_owned(),
            rows: vec![
                shell_row(reserved_height_px),
                text_event(ANCHOR_EVENT_VALUE, "visible anchor event"),
                text_event(10, &"below profile shell filler ".repeat(90)),
                FeedViewRow::Footer(footer_row("home-profile-shell", FeedFooterState::CacheHit)),
            ],
        },
    }
}

fn profile_row() -> FeedViewRow {
    FeedViewRow::Profile(FeedProfileRow {
        row_id: profile_row_id(),
        pubkey: profile_pubkey(),
        display_name: "profile card carrier preserves measured height ".repeat(80),
    })
}

fn shell_row(reserved_height_px: u16) -> FeedViewRow {
    let row_id = profile_row_id();
    FeedViewRow::Shell(FeedShellRow {
        row_id: row_id.clone(),
        semantic_row_id: row_id,
        reserved_height_px,
        represented_row_count: 1,
        route_group: "selected".to_owned(),
        coverage: "loaded-profile".to_owned(),
    })
}

fn text_event(value: u64, text: &str) -> FeedViewRow {
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
        content: FeedEventContent::Rows(vec![FeedEventContentRow::Text(text.to_owned())]),
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

fn profile_pubkey() -> String {
    pubkey("p")
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
