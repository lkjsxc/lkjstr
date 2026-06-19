#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod home_feed_live_insert_model;
mod home_feed_profile_hydration_dom;

use std::sync::{Arc, Mutex};

use accounts_selector_test_support::{click, next_task, reset_shells, wait_for_text};
use home_feed_live_insert_model::{
    ANCHOR_EVENT_VALUE, NEW_EVENT_VALUE, OLD_TOP_EVENT_VALUE, initial_model, live_insert_model,
    startup,
};
use home_feed_profile_hydration_dom::{
    assert_visible_anchor, event_row, home_scroll_owner, js_error, relative_top,
};
use lkjstr_ui::{HomeFeedProvider, HomeFeedRequest};
use lkjstr_web::mount_rust_workspace_shell_with_home_feed_provider;
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_live_insert_preserves_non_top_anchor() -> Result<(), JsValue> {
    reset_shells()?;
    let captured = CapturedHomeRequest::new();
    mount_rust_workspace_shell_with_home_feed_provider(startup(), captured.provider());
    open_home().await?;

    let owner = prepared_scroll_owner().await?;
    let anchor = event_row(ANCHOR_EVENT_VALUE)?;
    owner.set_scroll_top(relative_top(&owner, &anchor));
    next_task().await?;
    let before_top = owner.scroll_top();
    if before_top <= 0 {
        return Err(js_error("Home live-insert setup did not scroll"));
    }
    assert_visible_anchor(&owner, &anchor)?;

    captured.request()?.complete(live_insert_model());
    wait_for_text("new live insert event").await?;
    wait_for_preserved_anchor(&owner, before_top).await
}

#[wasm_bindgen_test(async)]
async fn rust_home_live_insert_at_top_shows_new_rows() -> Result<(), JsValue> {
    reset_shells()?;
    let captured = CapturedHomeRequest::new();
    mount_rust_workspace_shell_with_home_feed_provider(startup(), captured.provider());
    open_home().await?;

    let owner = prepared_scroll_owner().await?;
    owner.set_scroll_top(0);
    next_task().await?;
    captured.request()?.complete(live_insert_model());
    wait_for_text("new live insert event").await?;
    let inserted = event_row(NEW_EVENT_VALUE)?;
    if owner.scroll_top() != 0 {
        return Err(js_error("Home live insert moved the top-locked owner"));
    }
    assert_visible_anchor(&owner, &inserted)
}

#[derive(Clone)]
struct CapturedHomeRequest {
    inner: Arc<Mutex<Option<HomeFeedRequest>>>,
}

impl CapturedHomeRequest {
    fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
        }
    }

    fn provider(&self) -> HomeFeedProvider {
        let captured = self.inner.clone();
        HomeFeedProvider::new(move |request| {
            replace_request(&captured, request.clone());
            request.complete(initial_model());
        })
    }

    fn request(&self) -> Result<HomeFeedRequest, JsValue> {
        let guard = self
            .inner
            .lock()
            .map_err(|_| js_error("Home live-insert request capture poisoned"))?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| js_error("missing Home live-insert provider request"))
    }
}

fn replace_request(slot: &Arc<Mutex<Option<HomeFeedRequest>>>, request: HomeFeedRequest) {
    match slot.lock() {
        Ok(mut captured) => {
            captured.replace(request);
        }
        Err(poisoned) => {
            poisoned.into_inner().replace(request);
        }
    }
}

async fn open_home() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("visible anchor event").await
}

async fn prepared_scroll_owner() -> Result<web_sys::HtmlElement, JsValue> {
    let owner = home_scroll_owner()?;
    owner.set_attribute(
        "style",
        "display:block;height:112px;width:230px;overflow-y:auto;overflow-anchor:none;",
    )?;
    wait_for_observed_layout(OLD_TOP_EVENT_VALUE).await?;
    next_task().await?;
    Ok(owner)
}

async fn wait_for_observed_layout(value: u64) -> Result<(), JsValue> {
    let row = observer_row(value)?;
    for _ in 0..1_500 {
        next_task().await?;
        let measured = row
            .get_attribute("data-resize-anchor-height")
            .and_then(|value| value.parse::<i32>().ok())
            .unwrap_or_default();
        if measured > 0 && measured == row.offset_height() {
            return Ok(());
        }
    }
    Err(js_error(
        "Home live-insert observer did not measure setup layout",
    ))
}

fn observer_row(value: u64) -> Result<web_sys::HtmlElement, JsValue> {
    event_row(value)?
        .closest(".lkjstr-feed-row-observer")?
        .ok_or_else(|| js_error("missing Home live-insert observer row"))?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("Home live-insert observer row is not an HtmlElement"))
}

async fn wait_for_preserved_anchor(
    owner: &web_sys::HtmlElement,
    before_top: i32,
) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        if owner.scroll_top() > before_top
            && assert_visible_anchor(owner, &event_row(ANCHOR_EVENT_VALUE)?).is_ok()
        {
            return Ok(());
        }
    }
    Err(js_error("Home live insert did not preserve visible anchor"))
}
