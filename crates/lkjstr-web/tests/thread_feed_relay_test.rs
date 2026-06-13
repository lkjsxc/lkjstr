#![cfg(target_arch = "wasm32")]

use lkjstr_app::FeedFooterState;
use lkjstr_web::thread_feed_relay_test_api::{
    initial_complete_output_probe, initial_relay_plan_probe, live_relay_plan_probe,
    older_relay_plan_probe, thread_match_probe,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn thread_older_relay_plan_uses_bounded_cursor() -> Result<(), JsValue> {
    let plan = older_relay_plan_probe().ok_or_else(|| js_error("missing relay plan"))?;

    assert!(plan.sub_id.starts_with("thread:older:"));
    assert_eq!(plan.since, Some(1_940));
    assert_eq!(plan.until, Some(1_999));
    assert_eq!(plan.e_tags, Some(vec![id(1), id(2)]));
    assert!(plan.exact_ids.is_empty());
    Ok(())
}

#[wasm_bindgen_test]
fn thread_initial_relay_plan_requests_cached_parent_ids() -> Result<(), JsValue> {
    let plan = initial_relay_plan_probe().ok_or_else(|| js_error("missing initial plan"))?;

    assert_eq!(plan.exact_ids, vec![id(2), id(1), id(5)]);
    assert_eq!(plan.e_tags, Some(vec![id(1), id(2)]));
    Ok(())
}

#[wasm_bindgen_test]
fn thread_live_relay_plan_uses_newest_loaded_reply_cursor() -> Result<(), JsValue> {
    let plan = live_relay_plan_probe().ok_or_else(|| js_error("missing live relay plan"))?;

    assert_eq!(plan.sub_id, "thread:live");
    assert_eq!(plan.since, Some(2_000));
    assert_eq!(plan.until, Some(2_130));
    assert_eq!(plan.e_tags, Some(vec![id(1), id(2)]));
    assert!(plan.exact_ids.is_empty());
    Ok(())
}

#[wasm_bindgen_test]
fn thread_relay_read_rejects_unmatched_events() {
    let probe = thread_match_probe();

    assert!(probe.accepted);
    assert!(probe.branch_reference);
    assert!(!probe.before_window);
    assert!(!probe.wrong_root);
}

#[wasm_bindgen_test]
fn thread_initial_complete_retains_older_cursor() -> Result<(), JsValue> {
    let probe = initial_complete_output_probe().ok_or_else(|| js_error("missing output"))?;

    assert_eq!(probe.footer, Some(FeedFooterState::OlderLoadReady));
    assert_eq!(probe.unavailable_parent_count, 1);
    assert_eq!(probe.older_since, 1_940);
    assert_eq!(probe.older_until, 1_999);
    assert!(probe.starts_live);
    Ok(())
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
