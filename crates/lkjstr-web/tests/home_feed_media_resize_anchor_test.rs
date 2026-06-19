#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod home_feed_media_resize_model;
mod home_feed_profile_hydration_dom;

use accounts_selector_test_support::{click, next_task, reset_shells, wait_for_text};
use home_feed_media_resize_model::{MEDIA_ROW_KEY, home_model, startup};
use home_feed_profile_hydration_dom::{
    assert_visible_anchor, event_row, home_scroll_owner, js_error, relative_top,
};
use lkjstr_web::mount_rust_workspace_shell_with_home_feed;
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_media_resize_preserves_visible_anchor() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_home_feed(startup(), home_model());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("visible anchor event").await?;
    wait_for_text("media dimension carrier").await?;
    wait_for_media_observer().await?;

    let owner = home_scroll_owner()?;
    owner.set_attribute(
        "style",
        "display:block;height:112px;width:260px;overflow-y:auto;overflow-anchor:none;",
    )?;
    let media = media_attachment()?;
    let media_row = media_observer_row(&media)?;
    let anchor = event_row(20)?;
    owner.set_scroll_top(relative_top(&owner, &media_row) + media_row.offset_height().max(1));
    next_task().await?;
    let before_top = owner.scroll_top();
    let before_height = media_row.offset_height();
    if before_top <= 0 {
        return Err(js_error("Home media anchor setup did not scroll"));
    }
    if relative_top(&owner, &media_row) + before_height > before_top {
        return Err(js_error("Home media row was not above viewport"));
    }
    assert_visible_anchor(&owner, &anchor)?;

    media.set_attribute("style", "display:block;height:180px;width:220px;")?;
    wait_for_visible_anchor_after_resize(&owner, before_top, before_height).await
}

#[wasm_bindgen_test(async)]
async fn rust_home_media_shrink_preserves_visible_anchor() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_home_feed(startup(), home_model());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("visible anchor event").await?;
    wait_for_text("media dimension carrier").await?;
    wait_for_media_observer().await?;

    let owner = home_scroll_owner()?;
    owner.set_attribute(
        "style",
        "display:block;height:112px;width:260px;overflow-y:auto;overflow-anchor:none;",
    )?;
    let media = media_attachment()?;
    let media_row = media_observer_row(&media)?;
    let baseline = media_row.offset_height();
    media.set_attribute("style", "display:block;height:180px;width:220px;")?;
    wait_for_observed_height(&media_row, baseline.saturating_add(80)).await?;

    let anchor = event_row(20)?;
    owner.set_scroll_top(relative_top(&owner, &media_row) + media_row.offset_height().max(1));
    next_task().await?;
    let before_top = owner.scroll_top();
    let before_height = media_row.offset_height();
    if before_top <= 0 {
        return Err(js_error("Home media shrink setup did not scroll"));
    }
    if relative_top(&owner, &media_row) + before_height > before_top {
        return Err(js_error("Home grown media row was not above viewport"));
    }
    assert_visible_anchor(&owner, &anchor)?;

    media.set_attribute("style", "display:block;height:24px;width:220px;")?;
    wait_for_visible_anchor_after_shrink(&owner, before_top, before_height).await
}

fn media_attachment() -> Result<web_sys::HtmlElement, JsValue> {
    document()?
        .query_selector(&format!("[data-row-key='{MEDIA_ROW_KEY}']"))?
        .ok_or_else(|| js_error("missing media attachment"))?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("media attachment is not an HtmlElement"))
}

fn media_observer_row(media: &web_sys::HtmlElement) -> Result<web_sys::HtmlElement, JsValue> {
    media
        .closest(".lkjstr-feed-row-observer")?
        .ok_or_else(|| js_error("missing media observer row"))?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("media observer row is not an HtmlElement"))
}

async fn wait_for_visible_anchor_after_resize(
    owner: &web_sys::HtmlElement,
    before_top: i32,
    before_height: i32,
) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        if owner.scroll_top() > before_top && assert_visible_anchor(owner, &event_row(20)?).is_ok()
        {
            return Ok(());
        }
    }
    Err(resize_error(owner, before_top, before_height)?)
}

async fn wait_for_visible_anchor_after_shrink(
    owner: &web_sys::HtmlElement,
    before_top: i32,
    before_height: i32,
) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        if owner.scroll_top() < before_top && assert_visible_anchor(owner, &event_row(20)?).is_ok()
        {
            return Ok(());
        }
    }
    Err(resize_error(owner, before_top, before_height)?)
}

fn resize_error(
    owner: &web_sys::HtmlElement,
    before_top: i32,
    before_height: i32,
) -> Result<JsValue, JsValue> {
    let media = media_attachment()?;
    let media_row = media_observer_row(&media)?;
    Ok(js_error(&format!(
        "media dimension update above viewport did not preserve anchor: before_top={}, current_top={}, before_height={}, current_height={}, row_top={}, owner_height={}",
        before_top,
        owner.scroll_top(),
        before_height,
        media_row.offset_height(),
        relative_top(owner, &media_row),
        owner.client_height(),
    )))
}

async fn wait_for_media_observer() -> Result<(), JsValue> {
    let selector = format!(
        ".lkjstr-feed-row-observer[data-resize-anchor-observer='ready'] [data-row-key='{MEDIA_ROW_KEY}']"
    );
    for _ in 0..1_500 {
        next_task().await?;
        if document()?.query_selector(&selector)?.is_some() {
            return Ok(());
        }
    }
    Err(js_error("media resize observer did not attach"))
}

async fn wait_for_observed_height(row: &web_sys::HtmlElement, minimum: i32) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        let observed = row
            .get_attribute("data-resize-anchor-height")
            .and_then(|value| value.parse::<i32>().ok())
            .unwrap_or_default();
        if observed >= minimum {
            return Ok(());
        }
    }
    Err(js_error("media resize observer did not measure grown row"))
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}
