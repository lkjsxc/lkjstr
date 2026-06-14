#![cfg(target_arch = "wasm32")]

use lkjstr_app::{CustomRequestFeedStatus, FeedFooterState};
use lkjstr_web::custom_request_relay_test_api::{
    complete_output_probe, failed_empty_output_probe, relay_match_probe, relay_plan_probe,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::wasm_bindgen_test;

#[wasm_bindgen_test]
fn custom_request_relay_plan_uses_request_filters_and_relays() -> Result<(), JsValue> {
    let plan = relay_plan_probe().ok_or_else(|| js_error("missing relay plan"))?;

    assert!(plan.sub_id.starts_with("custom-request:initial:"));
    assert_eq!(plan.relays, vec!["wss://explicit.example/".to_owned()]);
    assert_eq!(plan.kinds, Some(vec![1]));
    assert_eq!(plan.authors, Some(vec![pubkey("a")]));
    assert_eq!(plan.since, Some(10));
    assert_eq!(plan.until, Some(20));
    assert_eq!(plan.e_tags, Some(vec![id(7)]));
    assert_eq!(plan.limit, Some(30));
    Ok(())
}

#[wasm_bindgen_test]
fn custom_request_relay_read_rejects_unmatched_events() -> Result<(), JsValue> {
    let probe = relay_match_probe().ok_or_else(|| js_error("missing match probe"))?;

    assert!(probe.accepted);
    assert!(!probe.wrong_author);
    assert!(!probe.missing_tag);
    assert!(!probe.wrong_kind);
    Ok(())
}

#[wasm_bindgen_test]
fn custom_request_complete_snapshot_renders_real_event_row() -> Result<(), JsValue> {
    let probe = complete_output_probe().ok_or_else(|| js_error("missing output probe"))?;

    assert_eq!(probe.status, CustomRequestFeedStatus::Ready);
    assert_eq!(probe.event_count, 1);
    assert_eq!(probe.first_event_id, Some(id(15)));
    assert_eq!(probe.footer, Some(FeedFooterState::TerminalWithRows));
    assert!(probe.partial_detail.is_none());
    Ok(())
}

#[wasm_bindgen_test]
fn custom_request_failed_empty_snapshot_renders_partial_state() -> Result<(), JsValue> {
    let probe = failed_empty_output_probe().ok_or_else(|| js_error("missing output probe"))?;

    assert_eq!(probe.status, CustomRequestFeedStatus::Partial);
    assert_eq!(probe.event_count, 0);
    assert_eq!(probe.partial_detail, Some("relay-error".to_owned()));
    assert_eq!(probe.footer, Some(FeedFooterState::Partial));
    Ok(())
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
