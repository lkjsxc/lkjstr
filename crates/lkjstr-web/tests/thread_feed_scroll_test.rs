#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod feed_scroll_structure_support;

use std::collections::BTreeMap;

use accounts_selector_test_support::{reset_shells, wait_for_text};
use feed_scroll_structure_support::{
    assert_feed_scroll_boundary, assert_tab_body_not_scroll_owner,
};
use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, RowGeometryModel, StartupInput,
    ThreadFeedSourceState, ThreadFeedView, ThreadFeedViewInput, build_thread_feed_view,
    default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_domain::{NewTabIds, TabKind, create_workspace, open_configured_tab};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_ui::{ThreadFeedProvider, mount_app_with_thread_feed_provider};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_thread_tab_uses_one_scroll_owner_for_status_and_rows() -> Result<(), JsValue> {
    reset_shells()?;
    mount_app_with_thread_feed_provider(
        startup(),
        ThreadFeedProvider::new(|request| request.complete(model())),
    );

    wait_for_text("scroll thread event 1").await?;
    assert_feed_scroll_boundary(
        ".lkjstr-thread-feed",
        ".thread-list-scroll[data-scroll-owner]",
        &[
            ".lkjstr-feed-status",
            ".lkjstr-feed-rows",
            ".lkjstr-feed-row.event",
            ".lkjstr-feed-footer",
        ],
    )?;
    assert_tab_body_not_scroll_owner(".lkjstr-tab-body[data-tab-kind='thread']")
}

fn model() -> ThreadFeedView {
    build_thread_feed_view(ThreadFeedViewInput {
        owner: "thread-scroll-owner".to_owned(),
        event_id: Some(id(2)),
        root_event_id: Some(id(1)),
        root_author: Some(pubkey()),
        source_state: ThreadFeedSourceState::Partial {
            reason: "older thread pages remain partial".to_owned(),
            retry_available: true,
        },
        unavailable_parent_ids: Vec::new(),
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        until: None,
        now_sec: 1_700_000_030,
        page_size: 30,
        window: reduce_feed_window(
            empty_feed_window(1, 240),
            FeedWindowEvidence::Events {
                generation: 1,
                events: (0..2).map(progressive).collect(),
                flags: FeedWindowFlags {
                    terminal: true,
                    has_older: true,
                    ..FeedWindowFlags::default()
                },
            },
        ),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
}

fn progressive(index: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "thread".to_owned(),
        event: NostrEvent {
            id: id(index + 10),
            pubkey: pubkey(),
            created_at: 1_700_000_001 + index,
            kind: KIND_TEXT_NOTE,
            tags: vec![vec![
                "e".to_owned(),
                id(1),
                String::new(),
                "root".to_owned(),
            ]],
            content: format!("scroll thread event {index}"),
            sig: "c".repeat(128),
        },
    }
}

fn startup() -> StartupInput {
    let ids = default_recovery_ids("main");
    let mut config = BTreeMap::new();
    config.insert("eventId".to_owned(), id(2));
    let workspace = open_configured_tab(
        create_workspace(ids.clone(), 1),
        Some(&ids.pane_id),
        TabKind::Thread,
        NewTabIds {
            tab_id: "thread-scroll-owner".to_owned(),
        },
        config,
        2,
    );
    StartupInput {
        stored_workspace: Some(workspace),
        storage_available: true,
        tab_snapshots: Vec::new(),
        recovery_ids: ids,
        now: 0,
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey() -> String {
    "a".repeat(64)
}
