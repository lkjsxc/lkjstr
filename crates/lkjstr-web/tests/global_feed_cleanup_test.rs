#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use accounts_selector_test_support::{click, reset_shells, wait_for_text};
use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, GlobalFeedSourceState, GlobalFeedView,
    GlobalFeedViewInput, RowGeometryModel, StartupInput, build_global_feed_view,
    default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_ui::{GlobalFeedProvider, GlobalFeedRequest, mount_app_with_global_feed_provider};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_global_tab_cleanup_suppresses_late_provider_completion() -> Result<(), JsValue> {
    reset_shells()?;
    let request_slot = Arc::new(Mutex::new(None::<GlobalFeedRequest>));
    let releases = Arc::new(AtomicUsize::new(0));
    let provider = recording_provider(request_slot.clone(), releases.clone());

    mount_app_with_global_feed_provider(startup(), provider);
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("Relay notes.").await?;
    click("[data-testid='new-tab-option-global']")?;
    let request = wait_for_request(&request_slot).await?;

    click_button_text("Welcome")?;
    wait_for_release(&releases).await?;
    request.complete(late_model());
    for _ in 0..10 {
        next_task().await?;
    }

    if document_text()?.contains("late global event") {
        return Err(js_error("late Global completion rendered"));
    }
    Ok(())
}

fn recording_provider(
    request_slot: Arc<Mutex<Option<GlobalFeedRequest>>>,
    releases: Arc<AtomicUsize>,
) -> GlobalFeedProvider {
    GlobalFeedProvider::new(move |request| {
        let releases = releases.clone();
        request.lease().on_release(move || {
            releases.fetch_add(1, Ordering::SeqCst);
        });
        match request_slot.lock() {
            Ok(mut slot) => {
                slot.replace(request);
            }
            Err(poisoned) => {
                poisoned.into_inner().replace(request);
            }
        }
    })
}

async fn wait_for_request(
    request_slot: &Arc<Mutex<Option<GlobalFeedRequest>>>,
) -> Result<GlobalFeedRequest, JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if let Some(request) = request_snapshot(request_slot) {
            return Ok(request);
        }
    }
    Err(js_error("timed out waiting for Global provider request"))
}

fn request_snapshot(
    request_slot: &Arc<Mutex<Option<GlobalFeedRequest>>>,
) -> Option<GlobalFeedRequest> {
    match request_slot.lock() {
        Ok(slot) => slot.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

async fn wait_for_release(releases: &Arc<AtomicUsize>) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if releases.load(Ordering::SeqCst) == 1 {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for Global provider release"))
}

fn click_button_text(label: &str) -> Result<(), JsValue> {
    let buttons = document()?.query_selector_all("button")?;
    for index in 0..buttons.length() {
        let Some(button) = buttons.item(index) else {
            continue;
        };
        if button.text_content().unwrap_or_default().trim() == label {
            button.dyn_into::<web_sys::HtmlElement>()?.click();
            return Ok(());
        }
    }
    Err(js_error(&format!("missing button: {label}")))
}

async fn next_task() -> Result<(), JsValue> {
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let callback = Closure::once_into_js(move || {
            let _ = resolve.call0(&JsValue::NULL);
        });
        let timeout = web_sys::window().and_then(|window| {
            window
                .set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), 0)
                .ok()
        });
        if timeout.is_none() {
            let _ = reject.call1(&JsValue::NULL, &js_error("missing timeout"));
        }
    });
    JsFuture::from(promise).await.map(|_| ())
}

fn document_text() -> Result<String, JsValue> {
    document()?
        .body()
        .map(|body| body.text_content().unwrap_or_default())
        .ok_or_else(|| js_error("missing body"))
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

fn late_model() -> GlobalFeedView {
    build_global_feed_view(GlobalFeedViewInput {
        owner: "released-global".to_owned(),
        source_state: GlobalFeedSourceState::CacheComplete,
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
                flags: FeedWindowFlags::default(),
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
            content: "late global event".to_owned(),
            sig: "b".repeat(128),
        },
    }
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
