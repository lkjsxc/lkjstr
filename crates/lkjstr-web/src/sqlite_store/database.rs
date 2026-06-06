#![doc = "SQLite worker-backed database handle."]

use lkjstr_storage::{
    StorageOperation, StorageOutcome, StorageProblem, sqlite_schema_hash, sqlite_schema_statements,
    sqlite_statement,
};

use crate::storage_worker::{
    BatchMode, OpenDatabase, SqlParams, SqlStep, StorageOp, StorageWorkerClient,
};

#[derive(Clone)]
pub struct SqliteStore {
    client: StorageWorkerClient,
    deadline_ms: u32,
}

impl SqliteStore {
    #[must_use]
    pub fn from_client(client: StorageWorkerClient, deadline_ms: u32) -> Self {
        Self {
            client,
            deadline_ms,
        }
    }

    pub async fn open(
        client: StorageWorkerClient,
        database_name: String,
        deadline_ms: u32,
    ) -> StorageOutcome<Self> {
        let store = Self::from_client(client, deadline_ms);
        let open = OpenDatabase {
            database_name,
            preferred_vfs: Some("opfs-sahpool".to_owned()),
            allow_sahpool: true,
            allow_transient: true,
        };
        match store
            .client
            .send(StorageOp::Open { database: open }, deadline_ms)
            .await
        {
            StorageOutcome::Ok(_) => {}
            outcome => return outcome.map(|_| store),
        }
        let statements = sqlite_schema_statements()
            .into_iter()
            .map(|statement| statement.sql.to_owned())
            .collect();
        store
            .client
            .send(
                StorageOp::ApplySchema {
                    schema_hash: sqlite_schema_hash(),
                    statements,
                },
                deadline_ms,
            )
            .await
            .map(|_| store)
    }

    pub async fn query(
        &self,
        id: &'static str,
        params: Option<SqlParams>,
        row_limit: u32,
    ) -> StorageOutcome<Vec<crate::storage_worker::SqlRow>> {
        let statement = match statement(id) {
            StorageOutcome::Ok(statement) => statement,
            outcome => return outcome.map(|_| Vec::new()),
        };
        self.client
            .send(
                StorageOp::Query {
                    statement: statement.sql.to_owned(),
                    params,
                    row_limit,
                },
                self.deadline_ms,
            )
            .await
            .map(|response| response.rows)
    }

    pub(crate) async fn query_sql(
        &self,
        statement: String,
        params: Option<SqlParams>,
        row_limit: u32,
    ) -> StorageOutcome<Vec<crate::storage_worker::SqlRow>> {
        self.client
            .send(
                StorageOp::Query {
                    statement,
                    params,
                    row_limit,
                },
                self.deadline_ms,
            )
            .await
            .map(|response| response.rows)
    }

    pub async fn execute(&self, id: &'static str, params: Option<SqlParams>) -> StorageOutcome<()> {
        let statement = match statement(id) {
            StorageOutcome::Ok(statement) => statement,
            outcome => return outcome.map(|_| ()),
        };
        self.client
            .send(
                StorageOp::Execute {
                    statement: statement.sql.to_owned(),
                    params,
                },
                self.deadline_ms,
            )
            .await
            .map(|_| ())
    }

    pub async fn batch(&self, steps: Vec<SqlStep>) -> StorageOutcome<()> {
        self.client
            .send(
                StorageOp::Batch {
                    mode: BatchMode::Readwrite,
                    steps,
                },
                self.deadline_ms,
            )
            .await
            .map(|_| ())
    }

    pub async fn close(&self) -> StorageOutcome<()> {
        self.client.close().await
    }

    pub fn step(&self, id: &'static str, params: Option<SqlParams>) -> StorageOutcome<SqlStep> {
        statement(id).map(|statement| SqlStep {
            statement: statement.sql.to_owned(),
            params,
        })
    }
}

fn statement(id: &'static str) -> StorageOutcome<&'static lkjstr_storage::SqliteStatementSpec> {
    sqlite_statement(id).map_or_else(
        || {
            StorageOutcome::Corrupt(StorageProblem::new(
                StorageOperation::Transaction,
                "sqlite_statements",
                "missing-statement",
                id,
            ))
        },
        StorageOutcome::Ok,
    )
}
