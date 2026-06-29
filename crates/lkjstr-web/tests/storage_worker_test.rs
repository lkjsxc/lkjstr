#![cfg(target_arch = "wasm32")]

use lkjstr_storage::StorageOutcome;
use lkjstr_web::storage_worker::{OpenDatabase, SqlScalar, StorageOp, StorageWorkerClient};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};
use web_sys::{Blob, Url};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn storage_worker_adapter_round_trips_responses() -> Result<(), JsValue> {
    let (client, url) = client_for(echo_worker())?;
    assert_ok(client.send(open_op("adapter.sqlite3"), 1_000).await)?;
    let response = assert_ok(client.send(query_op(10), 1_000).await)?;

    assert_eq!(response.rows.len(), 1);
    assert_eq!(
        response.rows[0].get("id").and_then(|value| value.as_i64()),
        Some(7)
    );
    assert_eq!(
        response.rows[0]
            .get("limit")
            .and_then(|value| value.as_u64()),
        Some(10)
    );
    assert_eq!(response.diagnostics.storage_usage_bytes, Some(22));

    assert_ok(client.close().await)?;
    Url::revoke_object_url(&url)
}

#[wasm_bindgen_test(async)]
async fn storage_worker_adapter_times_out_and_tracks_late_responses() -> Result<(), JsValue> {
    let (client, url) = client_for(delayed_worker())?;
    match client.send(query_op(10), 1).await {
        StorageOutcome::Timeout(problem) => assert_eq!(problem.reason, "timeout"),
        other => return Err(js_error(&format!("unexpected outcome: {other:?}"))),
    }
    delay_ms(80).await?;

    assert!(client.diagnostics().late_settled >= 1);
    let _outcome = client.close().await;
    Url::revoke_object_url(&url)
}

#[wasm_bindgen_test(async)]
async fn storage_worker_adapter_cancels_owned_requests() -> Result<(), JsValue> {
    let (client, url) = client_for(delayed_worker())?;
    let request = assert_ok(client.request(query_op(10), 1_000))?;
    let request_id = request.request_id().to_owned();
    assert_ok(request.cancel())?;

    match request.response().await {
        StorageOutcome::Canceled(problem) => assert_eq!(problem.operation_id, request_id),
        other => return Err(js_error(&format!("unexpected outcome: {other:?}"))),
    }
    assert_ok(client.close().await)?;
    Url::revoke_object_url(&url)
}

fn client_for(script: &str) -> Result<(StorageWorkerClient, String), JsValue> {
    let url = worker_url(script)?;
    match StorageWorkerClient::new_classic(&url) {
        StorageOutcome::Ok(client) => Ok((client, url)),
        outcome => Err(storage_error("worker open failed", &outcome)),
    }
}

fn worker_url(script: &str) -> Result<String, JsValue> {
    let parts = js_sys::Array::new();
    parts.push(&JsValue::from_str(script));
    let blob = Blob::new_with_str_sequence(&parts)?;
    Url::create_object_url_with_blob(&blob)
}

fn open_op(name: &str) -> StorageOp {
    StorageOp::Open {
        database: OpenDatabase {
            database_name: name.to_owned(),
            preferred_vfs: None,
            allow_sahpool: false,
            allow_opfs: false,
            allow_transient: false,
            worker_kind: None,
        },
    }
}

fn query_op(row_limit: u32) -> StorageOp {
    StorageOp::Query {
        statement: "SELECT".to_owned(),
        params: Some(vec![SqlScalar::Integer(7)]),
        row_limit,
    }
}

fn assert_ok<T>(outcome: StorageOutcome<T>) -> Result<T, JsValue> {
    match outcome {
        StorageOutcome::Ok(value) => Ok(value),
        other => Err(storage_error("unexpected storage outcome", &other)),
    }
}

fn storage_error<T>(label: &str, outcome: &StorageOutcome<T>) -> JsValue {
    let detail = outcome
        .problem()
        .map(|problem| problem.reason)
        .unwrap_or("unknown");
    js_error(&format!("{label}: {detail}"))
}

async fn delay_ms(ms: i32) -> Result<(), JsValue> {
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let Some(window) = web_sys::window() else {
            let _result = reject.call1(&JsValue::NULL, &js_error("missing window"));
            return;
        };
        let callback = Closure::once_into_js(move || {
            let _result = resolve.call0(&JsValue::NULL);
        });
        let _result = window
            .set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), ms);
    });
    JsFuture::from(promise).await.map(|_value| ())
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}

fn echo_worker() -> &'static str {
    "self.onmessage = (event) => {
      const request = event.data;
      const rows = request.op.kind === 'query'
        ? [{ id: 7, label: 'seven', limit: request.op.rowLimit }]
        : [];
      self.postMessage({
        requestId: request.requestId,
        outcome: 'ok',
        rows,
        rowsAffected: request.op.kind === 'execute' ? 1 : 0,
        diagnostics: { storageUsageBytes: 22, storageQuotaBytes: 44 }
      });
    };"
}

fn delayed_worker() -> &'static str {
    "self.onmessage = (event) => {
      const request = event.data;
      const response = {
        requestId: request.requestId,
        outcome: 'ok',
        rows: [],
        rowsAffected: 0,
        diagnostics: {}
      };
      setTimeout(() => self.postMessage(response), request.op.kind === 'cancel' ? 0 : 40);
    };"
}
