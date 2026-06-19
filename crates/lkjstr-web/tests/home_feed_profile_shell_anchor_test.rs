#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod home_feed_profile_hydration_dom;
mod home_feed_profile_shell_model;

use std::sync::{Arc, Mutex};

use accounts_selector_test_support::{click, next_task, reset_shells, wait_for_text};
use home_feed_profile_hydration_dom::{
    assert_visible_anchor, event_row, home_scroll_owner, js_error, relative_top,
};
use home_feed_profile_shell_model::{
    ANCHOR_EVENT_VALUE, dematerialized_model, initial_model, profile_row_id, startup,
};
use lkjstr_ui::{HomeFeedProvider, HomeFeedRequest};
use lkjstr_web::mount_rust_workspace_shell_with_home_feed_provider;
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_profile_shell_preserves_measured_reservation() -> Result<(), JsValue> {
    reset_shells()?;
    let captured = CapturedHomeRequest::new();
    mount_rust_workspace_shell_with_home_feed_provider(startup(), captured.provider());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("profile card carrier").await?;
    wait_for_text("visible anchor event").await?;

    let owner = home_scroll_owner()?;
    owner.set_attribute(
        "style",
        "display:block;height:112px;width:220px;overflow-y:auto;overflow-anchor:none;",
    )?;
    let profile = observed_profile_row()?;
    let measured_height = wait_for_observed_height(&profile, 90).await?;
    let anchor = event_row(ANCHOR_EVENT_VALUE)?;
    owner.set_scroll_top(
        relative_top(&owner, &profile)
            .saturating_add(measured_height)
            .saturating_add(1),
    );
    next_task().await?;
    if relative_top(&owner, &profile) + measured_height > owner.scroll_top() {
        return Err(js_error("profile shell carrier row was not above viewport"));
    }
    assert_visible_anchor(&owner, &anchor)?;

    captured
        .request()?
        .complete(dematerialized_model(clamp_height(measured_height)));
    let shell = wait_for_shell_anchor(&owner, measured_height).await?;
    if shell.offset_height() + 1 < measured_height {
        return Err(js_error("profile shell collapsed measured reservation"));
    }
    Ok(())
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
            .map_err(|_| js_error("Home profile shell request capture poisoned"))?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| js_error("missing Home profile shell request"))
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

async fn wait_for_observed_height(
    row: &web_sys::HtmlElement,
    minimum: i32,
) -> Result<i32, JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        let height = observed_height(row);
        if height >= minimum && height == row.offset_height() {
            return Ok(height);
        }
    }
    Err(js_error("profile shell carrier row was not measured"))
}

async fn wait_for_shell_anchor(
    owner: &web_sys::HtmlElement,
    minimum_height: i32,
) -> Result<web_sys::HtmlElement, JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        if let Some(shell) = shell_row()?
            && shell.offset_height() + 1 >= minimum_height
        {
            let anchor = event_row(ANCHOR_EVENT_VALUE)?;
            if assert_visible_anchor(owner, &anchor).is_ok() {
                return Ok(shell);
            }
        }
    }
    Err(js_error("profile shell did not keep reserved height"))
}

fn observed_height(row: &web_sys::HtmlElement) -> i32 {
    row.get_attribute("data-resize-anchor-height")
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or_default()
}

fn observed_profile_row() -> Result<web_sys::HtmlElement, JsValue> {
    profile_row()?
        .closest(".lkjstr-feed-row-observer")?
        .ok_or_else(|| js_error("missing profile shell observer row"))?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("profile shell observer row is not an HtmlElement"))
}

fn profile_row() -> Result<web_sys::HtmlElement, JsValue> {
    required_element(&format!(
        ".lkjstr-feed-row.profile[data-row-id='{}']",
        profile_row_id()
    ))
}

fn shell_row() -> Result<Option<web_sys::HtmlElement>, JsValue> {
    let Some(element) = document()?.query_selector(&format!(
        ".lkjstr-feed-row.lod-shell[data-semantic-row-id='{}']",
        profile_row_id()
    ))?
    else {
        return Ok(None);
    };
    element
        .dyn_into::<web_sys::HtmlElement>()
        .map(Some)
        .map_err(|_| js_error("profile shell is not an HtmlElement"))
}

fn required_element(selector: &str) -> Result<web_sys::HtmlElement, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing selector {selector}")))?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("selector did not resolve to HtmlElement"))
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn clamp_height(height: i32) -> u16 {
    height.clamp(1, i32::from(u16::MAX)) as u16
}
