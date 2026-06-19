#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod home_feed_profile_hydration_dom;
mod home_feed_reference_hydration_model;

use accounts_selector_test_support::{click, next_task, reset_shells, wait_for_text};
use home_feed_profile_hydration_dom::{
    assert_visible_anchor, event_row, home_scroll_owner, js_error, relative_top,
};
use home_feed_reference_hydration_model::{CapturedHomeRequest, startup};
use lkjstr_web::mount_rust_workspace_shell_with_home_feed_provider;
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_reference_hydration_preserves_visible_anchor() -> Result<(), JsValue> {
    reset_shells()?;
    let captured = CapturedHomeRequest::new();
    mount_rust_workspace_shell_with_home_feed_provider(startup(), captured.provider());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("visible anchor event").await?;
    wait_for_text("Reference preview unavailable").await?;

    let owner = home_scroll_owner()?;
    owner.set_attribute(
        "style",
        "display:block;height:112px;width:260px;overflow-y:auto;overflow-anchor:none;",
    )?;
    next_task().await?;
    let anchor = event_row(20)?;
    owner.set_scroll_top(relative_top(&owner, &anchor));
    next_task().await?;
    let before_top = owner.scroll_top();
    if before_top <= 0 {
        return Err(js_error("Home reference anchor setup did not scroll"));
    }

    captured.request()?.complete();
    wait_for_text("Referenced event unavailable").await?;
    next_task().await?;

    if owner.scroll_top() <= before_top {
        return Err(js_error(
            "reference hydration above viewport did not move scrollTop",
        ));
    }
    assert_visible_anchor(&owner, &event_row(20)?)
}
