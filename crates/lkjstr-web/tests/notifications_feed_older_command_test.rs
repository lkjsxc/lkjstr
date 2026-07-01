#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use std::sync::{Arc, Mutex};

use accounts_selector_test_support::{click, reset_shells, wait_for_text};
use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, NotificationsFeedSourceState,
    NotificationsFeedView, NotificationsFeedViewInput, NotificationsOlderLoadTrigger,
    ProtectedAccountAvailability, RowGeometryModel, StartupInput, build_notifications_feed_view,
    default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_ui::{
    NotificationsFeedProvider, NotificationsOlderRequest,
    mount_app_with_notifications_feed_provider,
};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};
mod read_plan_support;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_notifications_footer_button_requests_older_load() -> Result<(), JsValue> {
    reset_shells()?;
    let older_slot = Arc::new(Mutex::new(None::<NotificationsOlderRequest>));
    mount_app_with_notifications_feed_provider(startup(), provider(older_slot.clone()));

    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-notifications']")?;
    wait_for_text("Older rows available").await?;
    click("[data-testid='notifications-load-older']")?;

    let request = wait_for_older_request(&older_slot).await?;
    assert_eq!(request.trigger, NotificationsOlderLoadTrigger::Explicit);
    assert!(request.user_scrolled_down);
    assert!(!request.scrollable);
    Ok(())
}

fn provider(
    older_slot: Arc<Mutex<Option<NotificationsOlderRequest>>>,
) -> NotificationsFeedProvider {
    NotificationsFeedProvider::with_older(
        |request| request.complete(model()),
        move |request| match older_slot.lock() {
            Ok(mut slot) => {
                slot.replace(request);
            }
            Err(poisoned) => {
                poisoned.into_inner().replace(request);
            }
        },
    )
}

async fn wait_for_older_request(
    older_slot: &Arc<Mutex<Option<NotificationsOlderRequest>>>,
) -> Result<NotificationsOlderRequest, JsValue> {
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
        "timed out waiting for older Notifications request",
    ))
}

fn model() -> NotificationsFeedView {
    build_notifications_feed_view(NotificationsFeedViewInput {
        owner: "notifications-older-command".to_owned(),
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
                flags: FeedWindowFlags {
                    terminal: true,
                    has_older: true,
                    ..FeedWindowFlags::default()
                },
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
            id: "8".repeat(64),
            pubkey: pubkey("b"),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: vec![vec!["p".to_owned(), pubkey("a")]],
            content: "older command notification event".to_owned(),
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

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
