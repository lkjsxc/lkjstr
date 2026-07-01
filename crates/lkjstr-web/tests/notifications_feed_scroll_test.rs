#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod feed_scroll_structure_support;

use accounts_selector_test_support::{click, reset_shells, wait_for_text};
use feed_scroll_structure_support::{
    assert_feed_scroll_boundary, assert_tab_body_not_scroll_owner,
};
use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, NotificationItemInput,
    NotificationsFeedSourceState, NotificationsFeedView, NotificationsFeedViewInput,
    ProtectedAccountAvailability, RowGeometryModel, StartupInput, build_notifications_feed_view,
    default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_ui::{NotificationsFeedProvider, mount_app_with_notifications_feed_provider};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};
mod read_plan_support;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_notifications_chrome_and_source_event_share_scroll_owner() -> Result<(), JsValue> {
    reset_shells()?;
    mount_app_with_notifications_feed_provider(startup(), provider());

    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-notifications']")?;
    wait_for_text("mention").await?;
    wait_for_text("scroll notification event").await?;

    assert_feed_scroll_boundary(
        ".lkjstr-notifications-feed",
        ".notification-list-scroll[data-scroll-owner]",
        &[
            ".lkjstr-feed-status",
            ".lkjstr-feed-rows",
            ".lkjstr-feed-row.notification",
            ".lkjstr-feed-row.event[data-event-id='7777777777777777777777777777777777777777777777777777777777777777']",
            ".lkjstr-feed-footer",
        ],
    )?;
    assert_tab_body_not_scroll_owner(".lkjstr-tab-body[data-tab-kind='notifications']")
}

fn provider() -> NotificationsFeedProvider {
    NotificationsFeedProvider::new(|request| request.complete(model()))
}

fn model() -> NotificationsFeedView {
    build_notifications_feed_view(NotificationsFeedViewInput {
        owner: "notifications-scroll".to_owned(),
        account: ProtectedAccountAvailability::selected(pubkey("a")),
        source_state: NotificationsFeedSourceState::RelayProgressive,
        read_plan: read_plan_support::selected(),
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_030,
        page_size: 30,
        window: reduce_feed_window(
            empty_feed_window(1, 180),
            FeedWindowEvidence::Events {
                generation: 1,
                events: vec![progressive()],
                flags: FeedWindowFlags::default(),
            },
        ),
        notification_rows: vec![NotificationItemInput {
            notification_id: "notification-scroll-owner".to_owned(),
            notification_kind: "mention".to_owned(),
            source_event_id: Some("7".repeat(64)),
        }],
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
}

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "notifications".to_owned(),
        event: NostrEvent {
            id: "7".repeat(64),
            pubkey: pubkey("b"),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: vec![vec!["p".to_owned(), pubkey("a")]],
            content: notification_source_event_content(),
            sig: "c".repeat(128),
        },
    }
}

fn notification_source_event_content() -> String {
    format!("scroll notification event {}", "x".repeat(4096))
}

fn startup() -> StartupInput {
    StartupInput {
        stored_workspace: None,
        storage_available: true,
        tab_snapshots: Vec::new(),
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
