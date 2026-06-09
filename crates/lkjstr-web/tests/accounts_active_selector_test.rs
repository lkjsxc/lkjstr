#![cfg(target_arch = "wasm32")]

use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};
mod accounts_selector_test_support;

use accounts_selector_test_support::{
    WORKER_URL, account, assert_selector, clear_legacy, click, reset_shells, set_legacy,
    test_db_name, wait_for_legacy_clear, wait_for_text, write_accounts, write_bad_selector,
};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn accounts_migrates_legacy_selector_and_updates_activation() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("selector-migration");
    let first = account("1", 7)?;
    let second = account("2", 9)?;
    if let Err(error) = write_accounts(&db_name, &[first.clone(), second.clone()]).await {
        return skip_unavailable_worker(error);
    }
    set_legacy(&first.id)?;

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(
        db_name.clone(),
        WORKER_URL.to_owned(),
    );
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-account-manager']")?;
    wait_for_text("read-only").await?;
    wait_for_legacy_clear().await?;
    assert_selector(&db_name, &first.id).await?;

    click("input[name='active-account']")?;
    wait_for_text("Active account updated.").await?;
    assert_selector(&db_name, &second.id).await
}

#[wasm_bindgen_test(async)]
async fn accounts_reports_selector_read_failure() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("selector-failure");
    let account = account("3", 11)?;
    if let Err(error) = write_accounts(&db_name, &[account]).await {
        return skip_unavailable_worker(error);
    }
    write_bad_selector(&db_name).await?;
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-account-manager']")?;
    wait_for_text("Active account selector unavailable").await
}

fn skip_unavailable_worker(error: JsValue) -> Result<(), JsValue> {
    if format!("{error:?}").contains("unavailable") {
        return Ok(());
    }
    Err(error)
}
