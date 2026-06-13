#![cfg(target_arch = "wasm32")]

mod profile_feed_tab_support;

use profile_feed_tab_support::{click, open_profile_tab, wait_for_text};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_profile_tab_renders_injected_feed_view_model() -> Result<(), JsValue> {
    open_profile_tab().await?;
    wait_for_text("Profile ready").await?;
    wait_for_text("real profile event").await?;
    wait_for_text("Cached rows").await
}

#[wasm_bindgen_test(async)]
async fn rust_profile_following_count_opens_followees_tab() -> Result<(), JsValue> {
    open_profile_tab().await?;
    wait_for_text("2 following").await?;
    click("[aria-label='Open following list']")?;
    wait_for_text("Public follow list found.").await?;
    wait_for_text("best friend").await
}

#[wasm_bindgen_test(async)]
async fn rust_profile_action_opens_user_timeline_tab() -> Result<(), JsValue> {
    open_profile_tab().await?;
    wait_for_text("Open user timeline").await?;
    click("[aria-label='Open user timeline']")?;
    wait_for_text("User Timeline ready.").await?;
    wait_for_text("real timeline event").await
}

#[wasm_bindgen_test(async)]
async fn rust_profile_owner_action_opens_profile_edit_tab() -> Result<(), JsValue> {
    open_profile_tab().await?;
    wait_for_text("Edit profile").await?;
    click("[aria-label='Edit profile']")?;
    wait_for_text("The Rust Profile Edit body is not converted yet.").await
}
