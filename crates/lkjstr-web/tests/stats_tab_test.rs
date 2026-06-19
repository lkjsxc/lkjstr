#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::clear_legacy;
use lkjstr_storage::{StorageStatsSnapshot, StorageTableCount};
use lkjstr_ui::{StatsProvider, default_startup_input};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::{
    indexed_db, mount_rust_workspace_shell_from_db_with_worker,
    mount_rust_workspace_shell_with_stats_provider,
};

const TEST_WORKER_URL: &str = "/static/sqlite-opfs-worker.js";
const REPAIR_COMPLETE_TEXT: &str = "Repair report complete";
const REPAIR_UNAVAILABLE_TEXT: &str = "Storage action unavailable: unavailable";

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn storage_stats_snapshot_counts_manifest_tables() -> Result<(), JsValue> {
    let snapshot = indexed_db::inventory_store::storage_stats_snapshot(&test_db_name()).await;

    assert_eq!(snapshot.inventory_status, "complete");
    assert!(snapshot.table_count > 10);
    assert!(snapshot.rows.iter().any(|row| row.table == "workspaces"));
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn rust_stats_tab_renders_inventory_and_repair_action_state() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = accounts_selector_test_support::test_db_name("stats-geometry");
    mount_rust_workspace_shell_from_db_with_worker(db_name, TEST_WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-network-stats']")?;
    wait_for_text("Storage health").await?;
    wait_for_text("Storage bytes").await?;
    wait_for_text("Storage inventory").await?;
    wait_for_text("localStorage").await?;
    wait_for_text("workspaces").await?;
    wait_for_text("available").await?;
    wait_for_text("Auto refresh every 2s").await?;
    wait_for_text("Repair report").await?;
    assert!(!document_text()?.contains("Compact now"));
    click("[data-testid='stats-repair-report-action']")?;
    wait_for_any_text(&[REPAIR_COMPLETE_TEXT, REPAIR_UNAVAILABLE_TEXT]).await?;
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn rust_stats_tab_renders_injected_feed_runtime_counts() -> Result<(), JsValue> {
    reset_shells()?;
    let provider = StatsProvider::new(|complete| {
        complete.complete(stats_snapshot());
    });
    mount_rust_workspace_shell_with_stats_provider(default_startup_input(), provider);
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-network-stats']")?;
    wait_for_text("Feed geometry").await?;
    wait_for_text("Observed row heights").await?;
    wait_for_text("Geometry models").await?;
    wait_for_text("Scan optimizer").await?;
    wait_for_text("Scan hints").await?;
    wait_for_text("Scan decisions").await?;
    wait_for_text("Density models").await?;
    wait_for_text("17").await?;
    wait_for_text("13").await?;
    wait_for_text("23").await?;
    wait_for_text("19").await?;
    wait_for_text("11").await?;
    Ok(())
}

fn stats_snapshot() -> StorageStatsSnapshot {
    StorageStatsSnapshot::from_sqlite_counts(vec![
        StorageTableCount::available("feed_row_height_observations", 17),
        StorageTableCount::available("feed_row_height_models", 13),
        StorageTableCount::available("feed_scan_hints", 23),
        StorageTableCount::available("feed_scan_decision_traces", 19),
        StorageTableCount::available("feed_scan_density_models", 11),
    ])
}

async fn wait_for_text(text: &str) -> Result<(), JsValue> {
    wait_for_any_text(&[text]).await
}

async fn wait_for_any_text(texts: &[&str]) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        let document = document_text()?;
        if texts.iter().any(|text| document.contains(text)) {
            return Ok(());
        }
    }
    Err(js_error(&format!(
        "timed out waiting for text: {}; document: {}",
        texts.join(" or "),
        text_excerpt()?
    )))
}

async fn next_task() -> Result<(), JsValue> {
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let Some(window) = web_sys::window() else {
            let _result = reject.call1(&JsValue::NULL, &js_error("missing window"));
            return;
        };
        let callback = Closure::once_into_js(move || {
            let _result = resolve.call0(&JsValue::NULL);
        });
        let result = window
            .set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), 0);
        if let Err(error) = result {
            let _result = reject.call1(&JsValue::NULL, &error);
        }
    });
    JsFuture::from(promise).await.map(|_| ())
}

fn click(selector: &str) -> Result<(), JsValue> {
    let element = document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing clickable element: {selector}")))?;
    let button = element
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("click target is not an html element"))?;
    button.click();
    Ok(())
}

fn reset_shells() -> Result<(), JsValue> {
    while let Some(shell) = document()?.query_selector("[data-testid='rust-workspace-shell']")? {
        shell.remove();
    }
    Ok(())
}

fn document_text() -> Result<String, JsValue> {
    let body = document()?
        .body()
        .ok_or_else(|| js_error("missing document body"))?;
    Ok(body.text_content().unwrap_or_default())
}

fn text_excerpt() -> Result<String, JsValue> {
    let text = match document()?.query_selector("[data-testid='rust-workspace-shell']")? {
        Some(shell) => shell.text_content().unwrap_or_default(),
        None => document_text()?,
    };
    Ok(text.chars().take(1_000).collect())
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn test_db_name() -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!("lkjstr-stats-{}-{random}", js_sys::Date::now() as u64)
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
