#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{click, reset_shells, test_db_name, wait_for_text};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const UNAVAILABLE_WORKER_URL: &str = "https://example.invalid/sqlite-opfs-worker.js";

#[wasm_bindgen_test(async)]
async fn rust_home_startup_with_unavailable_storage_stays_explicit() -> Result<(), JsValue> {
    reset_shells()?;
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(
        test_db_name("home-startup-unavailable"),
        UNAVAILABLE_WORKER_URL.to_owned(),
    );
    wait_for_text("Welcome").await?;

    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("No active account").await?;
    wait_for_text("Home needs a selected account").await?;
    wait_for_text("Accounts unavailable").await?;
    wait_for_text("Relay settings unavailable").await
}
