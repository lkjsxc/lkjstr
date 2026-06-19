#![cfg(target_arch = "wasm32")]

use lkjstr_app::FeedFooterState;
use lkjstr_web::notifications_feed_relay_output_test_api::{
    cache_complete_probe, initial_complete_output_probe,
};
use lkjstr_web::notifications_feed_relay_test_api::{
    notification_match_probe, older_complete_empty_footer_probe,
    older_incomplete_empty_footer_probe, older_relay_plan_probe,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::wasm_bindgen_test;

#[wasm_bindgen_test]
fn notifications_older_relay_plan_uses_bounded_cursor() -> Result<(), JsValue> {
    let plan = older_relay_plan_probe().ok_or_else(|| js_error("missing relay plan"))?;

    assert!(plan.sub_id.starts_with("notifications:older:"));
    assert_eq!(plan.since, Some(1_880));
    assert_eq!(plan.until, Some(1_939));
    assert_eq!(plan.p_tags, Some(vec![pubkey("a")]));
    Ok(())
}

#[wasm_bindgen_test]
fn notifications_relay_read_rejects_unmatched_events() {
    let probe = notification_match_probe();

    assert!(probe.accepted);
    assert!(!probe.before_window);
    assert!(!probe.missing_p_tag);
}

#[wasm_bindgen_test]
fn notifications_complete_cache_skips_initial_relay_but_keeps_empty_probe() {
    let probe = cache_complete_probe();

    assert!(probe.visible_rows_skip_initial);
    assert!(probe.empty_rows_request_older);
}

#[wasm_bindgen_test]
fn notifications_older_empty_complete_keeps_retry_footer() {
    assert_eq!(
        older_complete_empty_footer_probe(),
        Some(FeedFooterState::OlderLoadReady)
    );
}

#[wasm_bindgen_test]
fn notifications_older_empty_incomplete_stays_partial() {
    assert_eq!(
        older_incomplete_empty_footer_probe(),
        Some(FeedFooterState::Partial)
    );
}

#[wasm_bindgen_test]
fn notifications_initial_complete_retains_older_cursor() -> Result<(), JsValue> {
    let probe = initial_complete_output_probe().ok_or_else(|| js_error("missing output"))?;

    assert_eq!(probe.footer, Some(FeedFooterState::OlderLoadReady));
    assert_eq!(probe.older_since, 1_940);
    assert_eq!(probe.older_until, 1_999);
    Ok(())
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
