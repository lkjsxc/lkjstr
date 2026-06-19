#![cfg(target_arch = "wasm32")]

mod feed_scroll_structure_support;
mod profile_feed_tab_support;

use feed_scroll_structure_support::{
    assert_feed_scroll_boundary, assert_tab_body_not_scroll_owner,
};
use lkjstr_app::{
    ProfileFeedView,
    feed::{FeedEventContent, FeedEventContentRow, FeedViewRow},
};
use profile_feed_tab_support::{
    click, open_profile_tab, open_profile_tab_with_model, profile_model, wait_for_text,
};
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
async fn rust_profile_tab_uses_one_scroll_owner_for_header_status_and_rows() -> Result<(), JsValue>
{
    open_profile_tab().await?;
    wait_for_text("real profile event").await?;

    assert_feed_scroll_boundary(
        ".lkjstr-profile-feed",
        ".profile-list-scroll[data-scroll-owner]",
        &[
            ".profile-card",
            ".lkjstr-feed-status",
            ".lkjstr-feed-rows",
            ".lkjstr-feed-row.event",
            ".lkjstr-feed-footer",
        ],
    )?;
    assert_tab_body_not_scroll_owner(".lkjstr-tab-body[data-tab-kind='profile']")
}

#[wasm_bindgen_test(async)]
async fn rust_profile_oversized_note_has_no_horizontal_overflow() -> Result<(), JsValue> {
    open_profile_tab_with_model(profile_oversized_note_model()?).await?;
    wait_for_text("profile oversized carrier").await?;

    assert_feed_scroll_boundary(
        ".lkjstr-profile-feed",
        ".profile-list-scroll[data-scroll-owner]",
        &[
            ".profile-card",
            ".lkjstr-feed-row.event[data-event-id='8888888888888888888888888888888888888888888888888888888888888888']",
        ],
    )
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

fn profile_oversized_note_model() -> Result<ProfileFeedView, JsValue> {
    let mut model = profile_model();
    for row in &mut model.view_model.rows {
        if let FeedViewRow::Event(event) = row {
            event.event_id = "8".repeat(64);
            event.row_id = "profile-oversized-note".to_owned();
            event.content =
                FeedEventContent::Rows(vec![FeedEventContentRow::Text(profile_oversized_text())]);
            return Ok(model);
        }
    }
    Err(JsValue::from_str("profile fixture missing event row"))
}

fn profile_oversized_text() -> String {
    format!("profile oversized carrier {}", "x".repeat(4096))
}
