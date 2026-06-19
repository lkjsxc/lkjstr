#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod feed_home_model_support;
mod feed_scroll_structure_support;

use accounts_selector_test_support::{click, reset_shells, wait_for_text};
use feed_home_model_support::{home_model, startup};
use feed_scroll_structure_support::{
    assert_feed_scroll_boundary, assert_tab_body_not_scroll_owner,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::mount_rust_workspace_shell_with_home_feed;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_feed_scroll_owner_is_structural_boundary() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_home_feed(startup(), home_model());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("real home event").await?;

    assert_feed_scroll_boundary(
        ".lkjstr-tab-body[data-tab-kind='timeline'] .feed-tab",
        ".home-list-scroll[data-scroll-owner]",
        &[
            ".lkjstr-feed-status",
            ".lkjstr-feed-rows",
            ".lkjstr-feed-row.event",
            ".lkjstr-feed-footer",
        ],
    )?;
    assert_tab_body_not_scroll_owner(".lkjstr-tab-body[data-tab-kind='timeline']")
}
