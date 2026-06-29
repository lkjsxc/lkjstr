#![cfg(target_arch = "wasm32")]

use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, HomeFeedSourceState,
    HomeFeedViewInput, HomeFollowState, ProtectedAccountAvailability, RowGeometryModel,
    StartupInput, build_home_feed_view, default_recovery_ids, empty_feed_window,
    reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_web::mount_rust_workspace_shell_with_home_feed;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_tab_renders_injected_feed_view_model() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_home_feed(startup(), home_model());
    open_home_tab().await?;
    wait_for_text("Home ready").await?;
    wait_for_text("real home event").await?;
    wait_for_text("Cached rows").await?;
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn rust_home_tab_uses_one_scroll_owner_for_status_and_rows() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_home_feed(startup(), home_model());
    open_home_tab().await?;
    wait_for_text("real home event").await?;

    let section = required_element(".lkjstr-home-feed")?;
    let owners = section.query_selector_all("[data-scroll-owner]")?;
    if owners.length() != 1 {
        return Err(js_error("Home tab did not render one scroll owner"));
    }
    let owner = required_element(".home-list-scroll")?;
    if !owner.has_attribute("data-scroll-owner") {
        return Err(js_error("Home scroll owner marker moved"));
    }
    for selector in [
        ".lkjstr-feed-status",
        ".lkjstr-feed-rows",
        ".lkjstr-feed-row.event",
        ".lkjstr-feed-footer",
    ] {
        if owner.query_selector(selector)?.is_none() {
            return Err(js_error(&format!("{selector} outside Home scroll owner")));
        }
    }
    Ok(())
}

fn home_model() -> lkjstr_app::HomeFeedView {
    build_home_feed_view(HomeFeedViewInput {
        owner: "browser-home".to_owned(),
        account: ProtectedAccountAvailability::selected(pubkey("a")),
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b")],
        },
        source_state: HomeFeedSourceState::CacheComplete,
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
        sub_id: "home".to_owned(),
        event: NostrEvent {
            id: "1".repeat(64),
            pubkey: pubkey("a"),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "real home event".to_owned(),
            sig: "b".repeat(128),
        },
    }
}

async fn open_home_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")
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

fn required_element(selector: &str) -> Result<web_sys::Element, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing selector {selector}")))
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
