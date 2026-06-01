#![cfg(target_arch = "wasm32")]

use lkjstr_domain::{SignerType, create_account, create_local_account_record};
use lkjstr_storage::StorageOutcome;
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::indexed_db;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn indexed_db_account_stores_round_trip_and_delete() -> Result<(), JsValue> {
    let db_name = test_db_name("accounts-round-trip");
    let account = create_account(&"aa".repeat(32), SignerType::Readonly, 11)
        .ok_or_else(|| js_error("account create failed"))?;
    assert_ok(indexed_db::account_store::account_put(&db_name, &account).await)?;
    let rows = match indexed_db::account_store::accounts_all(&db_name).await {
        StorageOutcome::Ok(rows) => rows,
        outcome => return Err(outcome_error("accounts all failed", outcome.problem())),
    };
    assert_eq!(rows, vec![account.clone()]);
    let (_local, secret) = create_local_account_record(None, 12)
        .map_err(|_| js_error("local account create failed"))?;
    assert_ok(indexed_db::local_secret_store::local_secret_put(&db_name, &secret).await)?;
    match indexed_db::local_secret_store::local_secret_get(&db_name, &secret.account_id).await {
        StorageOutcome::Ok(Some(row)) if row == secret => {}
        outcome => return Err(outcome_error("secret get failed", outcome.problem())),
    }
    assert_ok(indexed_db::account_store::account_delete(&db_name, &account.id).await)?;
    assert_ok(
        indexed_db::local_secret_store::local_secret_delete(&db_name, &secret.account_id).await,
    )?;
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn indexed_db_local_account_transaction_persists_account_and_secret() -> Result<(), JsValue> {
    let db_name = test_db_name("local-account-transaction");
    let (account, secret) = create_local_account_record(None, 22)
        .map_err(|_| js_error("local account create failed"))?;

    assert_ok(indexed_db::account_store::local_account_put(&db_name, &account, &secret).await)?;

    match indexed_db::account_store::account_get(&db_name, &account.id).await {
        StorageOutcome::Ok(Some(row)) if row == account => {}
        outcome => return Err(outcome_error("account get failed", outcome.problem())),
    }
    match indexed_db::local_secret_store::local_secret_get(&db_name, &account.id).await {
        StorageOutcome::Ok(Some(row)) if row == secret => Ok(()),
        outcome => Err(outcome_error("secret get failed", outcome.problem())),
    }
}

fn assert_ok(outcome: StorageOutcome<()>) -> Result<(), JsValue> {
    match outcome {
        StorageOutcome::Ok(()) => Ok(()),
        other => Err(outcome_error("storage write failed", other.problem())),
    }
}

fn outcome_error(message: &str, problem: Option<&lkjstr_storage::StorageProblem>) -> JsValue {
    match problem {
        Some(problem) => js_error(&format!("{message}: {}", problem.reason)),
        None => js_error(message),
    }
}

fn test_db_name(label: &str) -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!("lkjstr-{label}-{}-{random}", js_sys::Date::now() as u64)
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
