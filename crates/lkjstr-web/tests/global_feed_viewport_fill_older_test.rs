#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use std::sync::{Arc, Mutex};

use accounts_selector_test_support::{click, next_task, reset_shells, wait_for_text};
use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, GlobalFeedSourceState, GlobalFeedView,
    GlobalFeedViewInput, GlobalOlderLoadTrigger, RowGeometryModel, StartupInput,
    build_global_feed_view, default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_ui::{GlobalFeedProvider, GlobalOlderRequest, mount_app_with_global_feed_provider};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_global_underfilled_viewport_requests_older_load() -> Result<(), JsValue> {
    reset_shells()?;
    let older_slot = Arc::new(Mutex::new(None::<GlobalOlderRequest>));
    mount_app_with_global_feed_provider(startup(), provider(older_slot.clone()));

    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("Relay notes.").await?;
    click("[data-testid='new-tab-option-global']")?;
    wait_for_text("viewport fill global event").await?;

    let request = wait_for_older_request(&older_slot).await?;
    assert_eq!(request.trigger, GlobalOlderLoadTrigger::ViewportFill);
    assert!(!request.scrollable);
    assert!(!request.user_scrolled_down);
    Ok(())
}

fn provider(older_slot: Arc<Mutex<Option<GlobalOlderRequest>>>) -> GlobalFeedProvider {
    GlobalFeedProvider::with_older(
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
    older_slot: &Arc<Mutex<Option<GlobalOlderRequest>>>,
) -> Result<GlobalOlderRequest, JsValue> {
    for _ in 0..90 {
        next_task().await?;
        let snapshot = older_slot
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone();
        if let Some(request) = snapshot {
            return Ok(request);
        }
    }
    Err(js_error(
        "timed out waiting for older viewport-fill request",
    ))
}

fn model() -> GlobalFeedView {
    build_global_feed_view(GlobalFeedViewInput {
        owner: "global-viewport-fill-older".to_owned(),
        source_state: GlobalFeedSourceState::RelayProgressive,
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_030,
        page_size: 30,
        window: reduce_feed_window(
            empty_feed_window(1, 180),
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
        sub_id: "global".to_owned(),
        event: NostrEvent {
            id: "1".repeat(64),
            pubkey: "a".repeat(64),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "viewport fill global event".to_owned(),
            sig: "c".repeat(128),
        },
    }
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

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
