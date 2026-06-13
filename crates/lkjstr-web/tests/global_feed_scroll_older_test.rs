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
use lkjstr_ui::{
    GlobalFeedProvider, GlobalFeedRequest, GlobalOlderRequest, mount_app_with_global_feed_provider,
};
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_global_scroll_down_near_end_requests_older_load() -> Result<(), JsValue> {
    reset_shells()?;
    let read_slot = Arc::new(Mutex::new(None::<GlobalFeedRequest>));
    let older_slot = Arc::new(Mutex::new(None::<GlobalOlderRequest>));
    mount_app_with_global_feed_provider(startup(), provider(read_slot.clone(), older_slot.clone()));

    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("Relay notes.").await?;
    click("[data-testid='new-tab-option-global']")?;
    let request = wait_for_read_request(&read_slot).await?;
    make_global_scrollable()?;
    request.complete(model(24, true));
    wait_for_text("scroll global event 23").await?;

    let owner = required_html(".global-list-scroll")?;
    if owner.scroll_height() <= owner.client_height() {
        return Err(js_error("Global scroll owner was not scrollable"));
    }
    owner.set_scroll_top(owner.scroll_height());
    owner.dispatch_event(&web_sys::Event::new("scroll")?)?;

    let request = wait_for_older_request(&older_slot).await?;
    assert_eq!(request.trigger, GlobalOlderLoadTrigger::Scroll);
    assert!(request.scrollable);
    assert!(request.user_scrolled_down);
    Ok(())
}

fn provider(
    read_slot: Arc<Mutex<Option<GlobalFeedRequest>>>,
    older_slot: Arc<Mutex<Option<GlobalOlderRequest>>>,
) -> GlobalFeedProvider {
    GlobalFeedProvider::with_older(
        move |request| replace_slot(&read_slot, request),
        move |request| replace_slot(&older_slot, request),
    )
}

async fn wait_for_read_request(
    slot: &Arc<Mutex<Option<GlobalFeedRequest>>>,
) -> Result<GlobalFeedRequest, JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if let Some(request) = snapshot(slot) {
            return Ok(request);
        }
    }
    Err(js_error("timed out waiting for Global read request"))
}

async fn wait_for_older_request(
    slot: &Arc<Mutex<Option<GlobalOlderRequest>>>,
) -> Result<GlobalOlderRequest, JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if let Some(request) = snapshot(slot) {
            return Ok(request);
        }
    }
    Err(js_error("timed out waiting for Global older request"))
}

fn make_global_scrollable() -> Result<(), JsValue> {
    required_html(".global-list-scroll")?
        .set_attribute("style", "display:block;height:80px;overflow-y:auto;")?;
    required_element(".lkjstr-feed-rows")?.set_attribute("style", "display:block;min-height:620px;")
}

fn model(count: u64, has_older: bool) -> GlobalFeedView {
    build_global_feed_view(GlobalFeedViewInput {
        owner: "global-scroll-older".to_owned(),
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
                events: (0..count).map(progressive).collect(),
                flags: FeedWindowFlags {
                    terminal: true,
                    has_older,
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
        sub_id: "global".to_owned(),
        event: NostrEvent {
            id: format!("{index:064x}"),
            pubkey: "a".repeat(64),
            created_at: 1_700_000_001 + index,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: format!("scroll global event {index}"),
            sig: "c".repeat(128),
        },
    }
}

fn replace_slot<T: Clone>(slot: &Arc<Mutex<Option<T>>>, value: T) {
    let mut slot = slot.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    slot.replace(value);
}

fn snapshot<T: Clone>(slot: &Arc<Mutex<Option<T>>>) -> Option<T> {
    slot.lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone()
}

fn required_html(selector: &str) -> Result<web_sys::HtmlElement, JsValue> {
    required_element(selector)?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(Into::into)
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

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
