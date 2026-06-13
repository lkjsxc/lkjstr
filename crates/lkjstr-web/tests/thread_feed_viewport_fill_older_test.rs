#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use accounts_selector_test_support::{next_task, reset_shells, wait_for_text};
use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, RowGeometryModel, StartupInput,
    ThreadFeedSourceState, ThreadFeedView, ThreadFeedViewInput, ThreadOlderLoadTrigger,
    build_thread_feed_view, default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_domain::{NewTabIds, TabKind, create_workspace, open_configured_tab};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_ui::{ThreadFeedProvider, ThreadOlderRequest, mount_app_with_thread_feed_provider};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_thread_underfilled_viewport_requests_older_load() -> Result<(), JsValue> {
    reset_shells()?;
    let older_slot = Arc::new(Mutex::new(None::<ThreadOlderRequest>));
    mount_app_with_thread_feed_provider(startup(), provider(older_slot.clone()));

    wait_for_text("viewport fill thread event").await?;

    let request = wait_for_older_request(&older_slot).await?;
    assert_eq!(request.trigger, ThreadOlderLoadTrigger::ViewportFill);
    assert!(!request.scrollable);
    assert!(!request.user_scrolled_down);
    Ok(())
}

fn provider(older_slot: Arc<Mutex<Option<ThreadOlderRequest>>>) -> ThreadFeedProvider {
    ThreadFeedProvider::with_older(
        |request| request.complete(model()),
        move |request| {
            let mut slot = older_slot
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            slot.replace(request);
        },
    )
}

async fn wait_for_older_request(
    older_slot: &Arc<Mutex<Option<ThreadOlderRequest>>>,
) -> Result<ThreadOlderRequest, JsValue> {
    for _ in 0..90 {
        next_task().await?;
        let snapshot = match older_slot.lock() {
            Ok(slot) => slot.clone(),
            Err(poisoned) => poisoned.into_inner().clone(),
        };
        if let Some(request) = snapshot {
            return Ok(request);
        }
    }
    Err(js_error(
        "timed out waiting for older viewport-fill request",
    ))
}

fn model() -> ThreadFeedView {
    build_thread_feed_view(ThreadFeedViewInput {
        owner: "thread-viewport-fill-older".to_owned(),
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
                events: vec![progressive()],
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

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "thread".to_owned(),
        event: NostrEvent {
            id: id(10),
            pubkey: pubkey(),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: vec![vec![
                "e".to_owned(),
                id(1),
                String::new(),
                "root".to_owned(),
            ]],
            content: "viewport fill thread event".to_owned(),
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
            tab_id: "thread-viewport-fill-older".to_owned(),
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

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
