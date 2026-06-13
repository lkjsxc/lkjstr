#![cfg(target_arch = "wasm32")]

use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, GlobalFeedSourceState,
    GlobalFeedViewInput, RowGeometryModel, StartupInput, build_global_feed_view,
    default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_web::mount_rust_workspace_shell_with_global_feed;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_global_tab_renders_injected_feed_view_model() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_global_feed(startup(), global_model());
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("Relay notes.").await?;
    click("[data-testid='new-tab-option-global']")?;
    wait_for_text("Global ready").await?;
    wait_for_text("real global event").await?;
    wait_for_text("Cached rows").await
}

fn global_model() -> lkjstr_app::GlobalFeedView {
    build_global_feed_view(GlobalFeedViewInput {
        owner: "browser-global".to_owned(),
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
            pubkey: pubkey("a"),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "real global event".to_owned(),
            sig: "b".repeat(128),
        },
    }
}

async fn wait_for_text(text: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if document_text()?.contains(text) {
            return Ok(());
        }
    }
    Err(js_error(&format!("timed out waiting for text: {text}")))
}

fn click(selector: &str) -> Result<(), JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing clickable element"))?
        .dyn_into::<web_sys::HtmlElement>()?
        .click();
    Ok(())
}

async fn next_task() -> Result<(), JsValue> {
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let Some(window) = web_sys::window() else {
            let _result = reject.call1(&JsValue::NULL, &js_error("missing window"));
            return;
        };
        let callback = Closure::once_into_js(move || {
            let _result = resolve.call0(&JsValue::NULL);
        });
        if let Err(error) = window
            .set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), 0)
        {
            let _result = reject.call1(&JsValue::NULL, &error);
        }
    });
    JsFuture::from(promise).await.map(|_| ())
}

fn reset_shells() -> Result<(), JsValue> {
    while let Some(shell) = document()?.query_selector("[data-testid='rust-workspace-shell']")? {
        shell.remove();
    }
    Ok(())
}

fn document_text() -> Result<String, JsValue> {
    document()?
        .body()
        .and_then(|body| body.text_content())
        .ok_or_else(|| js_error("missing document text"))
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
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
    JsValue::from_str(message)
}
