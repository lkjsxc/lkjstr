#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{click, reset_shells, wait_for_text};
use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, NotificationsFeedSourceState,
    NotificationsFeedView, NotificationsFeedViewInput, RowGeometryModel, StartupInput,
    build_notifications_feed_view, default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_ui::{NotificationsFeedProvider, mount_app_with_notifications_feed_provider};
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_notifications_tab_uses_one_scroll_owner_for_status_and_rows() -> Result<(), JsValue> {
    reset_shells()?;
    mount_app_with_notifications_feed_provider(startup(), provider());

    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-notifications']")?;
    wait_for_text("scroll notification event").await?;

    let section = required_element(".lkjstr-notifications-feed")?;
    let owners = section.query_selector_all("[data-scroll-owner]")?;
    if owners.length() != 1 {
        return Err(js_error(
            "Notifications tab did not render one scroll owner",
        ));
    }
    let owner = owners
        .item(0)
        .ok_or_else(|| js_error("missing scroll owner"))?
        .dyn_into::<web_sys::Element>()?;
    for selector in [
        ".lkjstr-feed-status",
        ".lkjstr-feed-rows",
        ".lkjstr-feed-row.event",
        ".lkjstr-feed-footer",
    ] {
        if owner.query_selector(selector)?.is_none() {
            return Err(js_error(&format!("{selector} outside scroll owner")));
        }
    }
    Ok(())
}

fn provider() -> NotificationsFeedProvider {
    NotificationsFeedProvider::new(|request| request.complete(model()))
}

fn model() -> NotificationsFeedView {
    build_notifications_feed_view(NotificationsFeedViewInput {
        owner: "notifications-scroll".to_owned(),
        active_pubkey: Some(pubkey("a")),
        source_state: NotificationsFeedSourceState::RelayProgressive,
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
        notification_rows: Vec::new(),
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
            content: "scroll notification event".to_owned(),
            sig: "c".repeat(128),
        },
    }
}

fn required_element(selector: &str) -> Result<web_sys::Element, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing selector {selector}")))
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing document"))
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

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
