#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod feed_home_model_support;

use accounts_selector_test_support::{click, next_task, reset_shells, wait_for_text};
use feed_home_model_support::{home_model, startup};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::mount_rust_workspace_shell_with_home_feed;

const TEST_STYLES: &str = concat!(
    include_str!("../../../src/styles/tokens.css"),
    "\n",
    include_str!("../../../src/styles/scroll-layout.css"),
);

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_feed_and_form_tabs_share_track_edge_inset() -> Result<(), JsValue> {
    reset_shells()?;
    install_styles()?;
    mount_rust_workspace_shell_with_home_feed(startup(), home_model());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("real home event").await?;
    required_element(".home-list-scroll")?
        .set_attribute("style", "display:block;height:96px;overflow-anchor:none;")?;
    required_element(".lkjstr-feed-rows")?
        .set_attribute("style", "display:block;min-height:180px;")?;

    let home_inset = right_edge_inset(
        ".lkjstr-tab-body[data-tab-kind='timeline']",
        ".lkjstr-tab-body[data-tab-kind='timeline'] .home-list-scroll[data-scroll-owner]",
    )?;
    assert_visible_inset("Home", home_inset)?;

    click("[aria-label='New tab']")?;
    wait_for_selector(
        ".lkjstr-tab-body[data-tab-kind='new-tab'] .form-tab__scroll[data-scroll-owner]",
    )
    .await?;

    let form_inset = right_edge_inset(
        ".lkjstr-tab-body[data-tab-kind='new-tab']",
        ".lkjstr-tab-body[data-tab-kind='new-tab'] .form-tab__scroll[data-scroll-owner]",
    )?;
    assert_visible_inset("New Tab", form_inset)?;

    let delta = (home_inset - form_inset).abs();
    if delta > device_pixel_css_width() {
        return Err(js_error(&format!(
            "feed/form track-edge mismatch: home={home_inset}, form={form_inset}, delta={delta}",
        )));
    }
    Ok(())
}

async fn wait_for_selector(selector: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if document()?.query_selector(selector)?.is_some() {
            return Ok(());
        }
    }
    Err(js_error(&format!(
        "timed out waiting for selector: {selector}",
    )))
}

fn right_edge_inset(tab_selector: &str, owner_selector: &str) -> Result<f64, JsValue> {
    let tab = required_element(tab_selector)?.get_bounding_client_rect();
    let owner = required_element(owner_selector)?.get_bounding_client_rect();
    if tab.width() <= 0.0 || owner.width() <= 0.0 {
        return Err(js_error("track-edge proof measured a collapsed element"));
    }
    Ok(tab.right() - owner.right())
}

fn assert_visible_inset(label: &str, inset: f64) -> Result<(), JsValue> {
    if inset < 0.5 {
        return Err(js_error(&format!(
            "{label} track-edge inset did not load product CSS: {inset}",
        )));
    }
    Ok(())
}

fn required_element(selector: &str) -> Result<web_sys::Element, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing selector: {selector}")))
}

fn install_styles() -> Result<(), JsValue> {
    let document = document()?;
    if document
        .get_element_by_id("feed-tab-track-edge-test-css")
        .is_some()
    {
        return Ok(());
    }
    let style = document.create_element("style")?;
    style.set_id("feed-tab-track-edge-test-css");
    style.set_text_content(Some(TEST_STYLES));
    document
        .head()
        .ok_or_else(|| js_error("missing document head"))?
        .append_child(&style)?;
    Ok(())
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn device_pixel_css_width() -> f64 {
    let ratio = web_sys::window()
        .map(|window| window.device_pixel_ratio())
        .filter(|ratio| ratio.is_finite() && *ratio > 0.0)
        .unwrap_or(1.0);
    1.0 / ratio
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
