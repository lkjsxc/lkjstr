#![cfg(target_arch = "wasm32")]

use lkjstr_domain::bootstrap_workspace;
use lkjstr_storage::{StorageOutcome, WorkspaceRecord};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::{indexed_db, mount_rust_workspace_shell_from_db};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn indexed_db_workspace_store_round_trips() -> Result<(), JsValue> {
    let db_name = test_db_name("workspace-round-trip");
    let workspace = stored_workspace("Stored Welcome");
    assert_ok(indexed_db::workspace_store::workspace_put(&db_name, &workspace).await)?;
    let loaded = match indexed_db::workspace_store::workspace_get(&db_name, "main").await {
        StorageOutcome::Ok(Some(row)) => row,
        outcome => return Err(outcome_error("workspace get failed", outcome.problem())),
    };
    assert_eq!(loaded, workspace);
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn rust_shell_reads_workspace_startup_from_indexed_db() -> Result<(), JsValue> {
    reset_shells()?;
    let db_name = test_db_name("workspace-startup");
    let workspace = stored_workspace("Stored Welcome");
    assert_ok(indexed_db::workspace_store::workspace_put(&db_name, &workspace).await)?;
    mount_rust_workspace_shell_from_db(db_name);
    wait_for_shell().await?;
    assert!(document_text()?.contains("Stored Welcome"));
    Ok(())
}

fn stored_workspace(title: &str) -> WorkspaceRecord {
    let mut workspace = bootstrap_workspace();
    if let Some(tab) = workspace.tabs.get_mut("bootstrap-welcome-tab") {
        tab.title = title.to_owned();
    }
    workspace
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

async fn wait_for_shell() -> Result<(), JsValue> {
    for _ in 0..50 {
        next_task().await?;
        if document()?
            .query_selector("[data-testid='rust-workspace-shell']")?
            .is_some()
        {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for rust workspace shell"))
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
        if let Err(error) = window
            .set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), 0)
        {
            let _result = reject.call1(&JsValue::NULL, &error);
        }
    });
    JsFuture::from(promise).await.map(|_| ())
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

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
