#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use accounts_selector_test_support::{click, reset_shells, wait_for_text};
use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, NotificationsFeedSourceState,
    NotificationsFeedView, NotificationsFeedViewInput, ProtectedAccountAvailability,
    RowGeometryModel, StartupInput, build_notifications_feed_view, default_recovery_ids,
    empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_ui::{
    NotificationsFeedProvider, NotificationsFeedRequest, mount_app_with_notifications_feed_provider,
};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_notifications_tab_cleanup_suppresses_late_provider_completion() -> Result<(), JsValue>
{
    reset_shells()?;
    let request_slot = Arc::new(Mutex::new(None::<NotificationsFeedRequest>));
    let releases = Arc::new(AtomicUsize::new(0));
    let provider = recording_provider(request_slot.clone(), releases.clone());

    mount_app_with_notifications_feed_provider(startup(), provider);
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-notifications']")?;
    let request = wait_for_request(&request_slot).await?;

    click(".lkjstr-tab-strip button:first-child")?;
    wait_for_release(&releases).await?;
    request.complete(late_model());
    for _ in 0..10 {
        next_task().await?;
    }

    if document_text()?.contains("late notification event") {
        return Err(js_error("late Notifications completion rendered"));
    }
    Ok(())
}

fn recording_provider(
    request_slot: Arc<Mutex<Option<NotificationsFeedRequest>>>,
    releases: Arc<AtomicUsize>,
) -> NotificationsFeedProvider {
    NotificationsFeedProvider::new(move |request| {
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
    request_slot: &Arc<Mutex<Option<NotificationsFeedRequest>>>,
) -> Result<NotificationsFeedRequest, JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if let Some(request) = request_snapshot(request_slot) {
            return Ok(request);
        }
    }
    Err(js_error(
        "timed out waiting for Notifications provider request",
    ))
}

fn request_snapshot(
    request_slot: &Arc<Mutex<Option<NotificationsFeedRequest>>>,
) -> Option<NotificationsFeedRequest> {
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
    Err(js_error(
        "timed out waiting for Notifications provider release",
    ))
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

fn late_model() -> NotificationsFeedView {
    build_notifications_feed_view(NotificationsFeedViewInput {
        owner: "released-notifications".to_owned(),
        account: ProtectedAccountAvailability::selected("a".repeat(64)),
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
            id: "1".repeat(64),
            pubkey: "b".repeat(64),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: vec![vec!["p".to_owned(), "a".repeat(64)]],
            content: "late notification event".to_owned(),
            sig: "c".repeat(128),
        },
    }
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
