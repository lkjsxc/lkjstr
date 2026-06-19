#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod home_feed_media_resize_model;
mod home_feed_profile_hydration_dom;

use accounts_selector_test_support::{click, next_task, reset_shells, wait_for_text};
use home_feed_media_resize_model::{pane_resize_model, startup};
use home_feed_profile_hydration_dom::{
    assert_visible_anchor, event_row, home_scroll_owner, js_error, relative_top,
};
use lkjstr_web::mount_rust_workspace_shell_with_home_feed;
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_pane_width_resize_preserves_visible_anchor() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_home_feed(startup(), pane_resize_model());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("pane resize carrier").await?;
    wait_for_text("visible anchor event").await?;

    let owner = home_scroll_owner()?;
    owner.set_attribute("style", &owner_style(180))?;
    let row = observer_row(40)?;
    wait_for_observed_height(&row, 80).await?;
    let narrow_height = row.offset_height();
    owner.set_attribute("style", &owner_style(520))?;
    wait_for_height_at_most(&row, narrow_height.saturating_sub(1)).await?;

    let wide_height = row.offset_height();
    let anchor = event_row(20)?;
    owner.set_scroll_top(relative_top(&owner, &anchor));
    next_task().await?;
    let wide_top = owner.scroll_top();
    if relative_top(&owner, &row) + wide_height > wide_top {
        return Err(js_error("wide pane resize row was not above viewport"));
    }
    assert_visible_anchor(&owner, &anchor)?;

    owner.set_attribute("style", &owner_style(180))?;
    wait_for_width_growth_anchor(&owner, &row, wide_top, wide_height).await?;
    let grown_top = owner.scroll_top();
    let grown_height = row.offset_height();

    owner.set_attribute("style", &owner_style(520))?;
    wait_for_width_shrink_anchor(&owner, &row, grown_top, grown_height).await
}

async fn wait_for_width_growth_anchor(
    owner: &web_sys::HtmlElement,
    row: &web_sys::HtmlElement,
    before_top: i32,
    before_height: i32,
) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        if owner.scroll_top() > before_top
            && row.offset_height() > before_height
            && assert_visible_anchor(owner, &event_row(20)?).is_ok()
        {
            return Ok(());
        }
    }
    Err(resize_error(
        "pane width shrink",
        owner,
        row,
        before_top,
        before_height,
    ))
}

async fn wait_for_width_shrink_anchor(
    owner: &web_sys::HtmlElement,
    row: &web_sys::HtmlElement,
    before_top: i32,
    before_height: i32,
) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        if owner.scroll_top() < before_top
            && row.offset_height() < before_height
            && assert_visible_anchor(owner, &event_row(20)?).is_ok()
        {
            return Ok(());
        }
    }
    Err(resize_error(
        "pane width widen",
        owner,
        row,
        before_top,
        before_height,
    ))
}

async fn wait_for_observed_height(row: &web_sys::HtmlElement, minimum: i32) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        if observed_height(row) >= minimum {
            return Ok(());
        }
    }
    Err(js_error("pane resize observer did not measure row"))
}

async fn wait_for_height_at_most(row: &web_sys::HtmlElement, maximum: i32) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        let observed = observed_height(row);
        if observed > 0 && observed <= maximum && row.offset_height() <= maximum {
            return Ok(());
        }
    }
    Err(js_error("pane resize observer did not measure widened row"))
}

fn observed_height(row: &web_sys::HtmlElement) -> i32 {
    row.get_attribute("data-resize-anchor-height")
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or_default()
}

fn observer_row(value: u64) -> Result<web_sys::HtmlElement, JsValue> {
    event_row(value)?
        .closest(".lkjstr-feed-row-observer")?
        .ok_or_else(|| js_error("missing pane resize observer row"))?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("pane resize observer row is not an HtmlElement"))
}

fn owner_style(width: i32) -> String {
    format!("display:block;height:112px;width:{width}px;overflow-y:auto;overflow-anchor:none;")
}

fn resize_error(
    label: &str,
    owner: &web_sys::HtmlElement,
    row: &web_sys::HtmlElement,
    before_top: i32,
    before_height: i32,
) -> JsValue {
    js_error(&format!(
        "{label} above viewport did not preserve anchor: before_top={}, current_top={}, before_height={}, current_height={}, observed_height={}, row_top={}",
        before_top,
        owner.scroll_top(),
        before_height,
        row.offset_height(),
        observed_height(row),
        relative_top(owner, row),
    ))
}
