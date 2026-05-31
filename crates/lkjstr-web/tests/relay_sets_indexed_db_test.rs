#![cfg(target_arch = "wasm32")]

use lkjstr_domain::{RelayPatch, add_relay, patch_relay, seed_relay_sets};
use lkjstr_storage::StorageOutcome;
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::indexed_db::relay_set_store;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn relay_set_rows_round_trip_through_indexed_db() -> Result<(), JsValue> {
    let db_name = test_db_name();
    let seeded = seed_relay_sets(&[], 10);
    assert_ok(relay_set_store::relay_sets_put_all(&db_name, &seeded).await)?;
    let added = add_relay(&seeded, "public-default", "relay.example", 20)
        .map_err(|error| JsValue::from_str(&format!("{error:?}")))?;
    let patched = patch_relay(
        &added,
        "public-default",
        "wss://relay.example/",
        RelayPatch::Enabled(false),
        30,
    )
    .map_err(|error| JsValue::from_str(&format!("{error:?}")))?;
    assert_ok(relay_set_store::relay_sets_put_all(&db_name, &patched).await)?;
    let loaded = match relay_set_store::relay_sets_all(&db_name).await {
        StorageOutcome::Ok(rows) => rows,
        outcome => return Err(outcome_error(outcome.problem())),
    };
    let relay = loaded[0]
        .relays
        .iter()
        .find(|relay| relay.url == "wss://relay.example/")
        .ok_or_else(|| JsValue::from_str("missing added relay"))?;
    assert!(!relay.enabled);
    Ok(())
}

fn assert_ok(outcome: StorageOutcome<()>) -> Result<(), JsValue> {
    match outcome {
        StorageOutcome::Ok(()) => Ok(()),
        outcome => Err(outcome_error(outcome.problem())),
    }
}

fn outcome_error(problem: Option<&lkjstr_storage::StorageProblem>) -> JsValue {
    match problem {
        Some(problem) => JsValue::from_str(problem.reason),
        None => JsValue::from_str("relay set storage failed"),
    }
}

fn test_db_name() -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!("lkjstr-relays-{}-{random}", js_sys::Date::now() as u64)
}
