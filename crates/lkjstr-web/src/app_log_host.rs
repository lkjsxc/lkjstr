use lkjstr_storage::{AppLogRecord, StorageOutcome};
use lkjstr_ui::{LogProvider, LogResult};

use crate::{
    host_status::{browser_now_ms, problem_status},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_app_log_clear_before, sqlite_app_log_recent},
};

const LOG_LIMIT: u64 = 200;

pub fn log_provider_with_worker_url(db_name: String, worker_url: String) -> LogProvider {
    let read_db = db_name.clone();
    let read_worker = worker_url.clone();
    LogProvider::new(
        move |complete| spawn_read(read_db.clone(), read_worker.clone(), complete),
        move |complete| spawn_clear(db_name.clone(), worker_url.clone(), complete),
    )
}

fn spawn_read(db_name: String, worker_url: String, complete: lkjstr_ui::LogComplete) {
    wasm_bindgen_futures::spawn_local(async move {
        complete.complete(read_log_result(&db_name, &worker_url).await);
    });
}

fn spawn_clear(db_name: String, worker_url: String, complete: lkjstr_ui::LogComplete) {
    wasm_bindgen_futures::spawn_local(async move {
        let clear = with_sqlite_store(&db_name, &worker_url, |store| async move {
            sqlite_app_log_clear_before(&store, browser_now_ms()).await
        })
        .await;
        if !clear.is_ok() {
            complete.complete(LogResult::problem(problem_status(
                "Log clear failed",
                clear,
            )));
            return;
        }
        complete.complete(read_log_result(&db_name, &worker_url).await);
    });
}

async fn read_log_result(db_name: &str, worker_url: &str) -> LogResult {
    let result = with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_app_log_recent(&store, LOG_LIMIT).await
    })
    .await;
    match result {
        StorageOutcome::Ok(rows) => LogResult::available(redacted_rows(rows)),
        outcome => LogResult::problem(problem_status("Log storage unavailable", outcome)),
    }
}

fn redacted_rows(rows: Vec<AppLogRecord>) -> Vec<AppLogRecord> {
    rows.into_iter().map(redacted_row).collect()
}

fn redacted_row(row: AppLogRecord) -> AppLogRecord {
    AppLogRecord {
        message: lkjstr_storage::redact_app_log_text(&row.message),
        context_json: lkjstr_storage::redact_app_log_text(&row.context_json),
        record_json: lkjstr_storage::redact_app_log_text(&row.record_json),
        ..row
    }
}
