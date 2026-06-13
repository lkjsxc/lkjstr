#![cfg(target_arch = "wasm32")]

use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE};
use lkjstr_web::author_context_relay_test_api::{
    author_context_anchor_plan_probe, author_context_relay_match_probe,
    author_context_relay_plan_probe,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn author_context_relay_plan_uses_selected_relay_and_bounded_filters() -> Result<(), JsValue> {
    let plan = author_context_relay_plan_probe().ok_or_else(|| js_error("missing plan"))?;

    assert!(plan.sub_id.starts_with("author-context:"));
    assert_eq!(
        plan.relays,
        vec![
            "wss://author-route.example/".to_owned(),
            "wss://selected.example/".to_owned()
        ]
    );
    assert_eq!(plan.filters.len(), 2);
    assert_eq!(plan.filters[0].since, Some(1_699_913_610));
    assert_eq!(plan.filters[0].until, Some(1_700_000_010));
    assert_eq!(plan.filters[0].limit, Some(10));
    assert_eq!(plan.filters[1].since, Some(1_700_000_010));
    assert_eq!(plan.filters[1].until, Some(1_700_086_410));
    assert_eq!(plan.filters[1].limit, Some(11));
    assert_eq!(plan.filters[0].authors, Some(vec!["a".repeat(64)]));
    assert_eq!(
        plan.filters[0].kinds,
        Some(vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST])
    );
    Ok(())
}

#[wasm_bindgen_test]
fn author_context_anchor_lookup_uses_exact_filter_and_author_route() -> Result<(), JsValue> {
    let plan = author_context_anchor_plan_probe().ok_or_else(|| js_error("missing plan"))?;

    assert_eq!(
        plan.relays,
        vec![
            "wss://author-route.example/".to_owned(),
            "wss://selected.example/".to_owned()
        ]
    );
    assert_eq!(plan.filters.len(), 1);
    assert_eq!(plan.filters[0].ids, Some(vec![format!("{:064x}", 1_u64)]));
    assert_eq!(plan.filters[0].authors, Some(vec!["a".repeat(64)]));
    assert_eq!(plan.filters[0].limit, Some(1));
    Ok(())
}

#[wasm_bindgen_test]
fn author_context_relay_match_rejects_wrong_author_kind_and_window() {
    let matches = author_context_relay_match_probe();

    assert!(matches.older_same_author);
    assert!(matches.newer_same_author);
    assert!(matches.exact_anchor);
    assert!(!matches.nearby_before_anchor);
    assert!(!matches.wrong_author);
    assert!(!matches.unsupported_kind);
    assert!(!matches.outside_window);
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
