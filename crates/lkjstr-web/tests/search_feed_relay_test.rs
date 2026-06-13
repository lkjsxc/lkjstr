#![cfg(target_arch = "wasm32")]

use lkjstr_app::FeedFooterState;
use lkjstr_web::search_feed_relay_test_api::{
    full_page_footer_probe, older_relay_plan_probe, search_match_probe,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn search_older_relay_plan_uses_compound_cursor_boundary() -> Result<(), JsValue> {
    let plan = older_relay_plan_probe().ok_or_else(|| js_error("missing relay plan"))?;

    assert!(plan.sub_id.starts_with("search:older:"));
    assert_eq!(plan.until, Some(2_001));
    assert_eq!(plan.kinds, Some(vec![1, 6, 16]));
    assert_eq!(plan.search.as_deref(), Some("nostr wasm"));
    Ok(())
}

#[wasm_bindgen_test]
fn search_relay_read_rejects_events_outside_older_cursor() {
    let probe = search_match_probe();

    assert!(probe.older_timestamp);
    assert!(probe.same_second_after_cursor);
    assert!(!probe.same_second_before_cursor);
    assert!(!probe.unsupported_kind);
}

#[wasm_bindgen_test]
fn search_relay_full_page_keeps_older_footer_ready() {
    assert_eq!(
        full_page_footer_probe(),
        Some(FeedFooterState::OlderLoadReady)
    );
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
