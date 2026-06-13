#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{WORKER_URL, test_db_name};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_METADATA, KIND_RELAY_LIST_METADATA};
use lkjstr_web::profile_feed_header_relay_test_api::{
    header_relay_match_probe, header_relay_plan_probe, header_relay_store_probe,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn profile_header_relay_splits_metadata_and_follow_filters() -> Result<(), JsValue> {
    let probe = header_relay_plan_probe().ok_or_else(|| js_error("missing plan"))?;

    assert_eq!(
        probe.relays,
        vec!["wss://author.example", "wss://selected.example"]
    );
    assert_eq!(
        probe.author_kinds,
        vec![KIND_METADATA, KIND_RELAY_LIST_METADATA]
    );
    assert_eq!(probe.selected_kinds, vec![KIND_FOLLOW_LIST]);
    assert_eq!(
        probe.fallback_selected_kinds,
        vec![KIND_METADATA, KIND_RELAY_LIST_METADATA, KIND_FOLLOW_LIST]
    );
    Ok(())
}

#[wasm_bindgen_test]
fn profile_header_relay_matches_only_profile_header_events() -> Result<(), JsValue> {
    let probe = header_relay_match_probe().ok_or_else(|| js_error("missing match probe"))?;

    assert!(probe.metadata);
    assert!(probe.follow_list);
    assert!(probe.relay_list_metadata);
    assert!(!probe.note);
    assert!(!probe.wrong_author);
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn profile_header_relay_stores_events_before_rebuilding_header() -> Result<(), JsValue> {
    let db_name = test_db_name("profile-header-relay");
    let probe = header_relay_store_probe(&db_name, WORKER_URL).await;
    if let Some(problem) = probe.store_problem {
        if problem.contains("unavailable") {
            return Ok(());
        }
        return Err(js_error(&problem));
    }

    assert_eq!(probe.display_name.as_deref(), Some("Relay Rustacean"));
    assert_eq!(probe.following_label.as_deref(), Some("2 following"));
    assert!(probe.following_known);
    Ok(())
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
