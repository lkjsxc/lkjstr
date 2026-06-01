use lkjstr_storage::{
    CacheLedgerRecord, StorageOperation, StorageOutcome, TabStateRecord, tab_state_ledger_record,
};

use crate::indexed_db::database::{CACHE_LEDGER_TABLE, DEFAULT_DB_NAME, TAB_STATES_TABLE};
use crate::indexed_db::{database, record_requests, transaction};

pub async fn default_tab_state_get(id: &str) -> StorageOutcome<Option<TabStateRecord>> {
    tab_state_get(DEFAULT_DB_NAME, id).await
}

pub async fn tab_state_put(db_name: &str, row: &TabStateRecord) -> StorageOutcome<()> {
    let ledger = match tab_state_ledger_record(row) {
        Ok(ledger) => ledger,
        Err(_) => {
            return database::corrupt(
                StorageOperation::Transaction,
                TAB_STATES_TABLE,
                row.id.clone(),
            );
        }
    };
    let row_record = match transaction::put_record(TAB_STATES_TABLE, row) {
        Ok(record) => record,
        Err(error) => return map_transaction(row.id.clone(), error),
    };
    let ledger_record = match transaction::put_record(CACHE_LEDGER_TABLE, &ledger) {
        Ok(record) => record,
        Err(error) => return map_transaction(row.id.clone(), error),
    };
    transaction::put_records(
        db_name,
        TAB_STATES_TABLE,
        format!("tab-state-put-{}", row.id),
        vec![row_record, ledger_record],
    )
    .await
}

pub async fn tab_state_get(db_name: &str, id: &str) -> StorageOutcome<Option<TabStateRecord>> {
    record_requests::get(db_name, TAB_STATES_TABLE, id).await
}

pub async fn tab_state_ledger_get(
    db_name: &str,
    id: &str,
) -> StorageOutcome<Option<CacheLedgerRecord>> {
    record_requests::get(db_name, CACHE_LEDGER_TABLE, id).await
}

pub async fn tab_states_for_workspace(
    db_name: &str,
    workspace_id: &str,
) -> StorageOutcome<Vec<TabStateRecord>> {
    let operation_id = format!("tab-states-for-workspace-{workspace_id}");
    let values =
        match record_requests::all_values(db_name, TAB_STATES_TABLE, operation_id.clone()).await {
            StorageOutcome::Ok(values) => values,
            outcome => return outcome.map(|_| Vec::new()),
        };
    let mut rows = Vec::new();
    for value in values {
        match serde_wasm_bindgen::from_value::<TabStateRecord>(value) {
            Ok(row) if row.workspace_id == workspace_id => rows.push(row),
            Ok(_) => {}
            Err(_) => {
                return database::corrupt(StorageOperation::Read, TAB_STATES_TABLE, operation_id);
            }
        }
    }
    rows.sort_by(|left, right| {
        left.updated_at
            .cmp(&right.updated_at)
            .then_with(|| left.tab_id.cmp(&right.tab_id))
    });
    StorageOutcome::Ok(rows)
}

fn map_transaction<T>(
    operation_id: String,
    error: wasm_bindgen::prelude::JsValue,
) -> StorageOutcome<T> {
    database::map_js_error(
        StorageOperation::Transaction,
        TAB_STATES_TABLE,
        operation_id,
        error,
    )
}
