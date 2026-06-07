use leptos::prelude::{Callable, Callback};
use lkjstr_storage::AppLogRecord;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LogResult {
    pub status: String,
    pub rows: Vec<AppLogRecord>,
}

#[derive(Clone)]
pub struct LogProvider {
    read: Callback<LogComplete>,
    clear: Callback<LogComplete>,
}

#[derive(Clone)]
pub struct LogComplete {
    complete: Callback<LogResult>,
}

impl LogComplete {
    pub fn complete(&self, result: LogResult) {
        let _unused = self.complete.try_run(result);
    }
}

impl LogResult {
    #[must_use]
    pub fn available(rows: Vec<AppLogRecord>) -> Self {
        let status = if rows.is_empty() {
            "No durable log rows stored".to_string()
        } else {
            format!("Loaded {} durable log rows", rows.len())
        };
        Self { status, rows }
    }

    #[must_use]
    pub fn problem(status: impl Into<String>) -> Self {
        Self {
            status: status.into(),
            rows: Vec::new(),
        }
    }
}

impl LogProvider {
    #[must_use]
    pub fn new(
        read: impl Fn(LogComplete) + Send + Sync + 'static,
        clear: impl Fn(LogComplete) + Send + Sync + 'static,
    ) -> Self {
        Self {
            read: Callback::new(read),
            clear: Callback::new(clear),
        }
    }

    #[must_use]
    pub fn unavailable() -> Self {
        Self::new(
            |complete| {
                complete.complete(LogResult::problem("Log storage unavailable in this host"))
            },
            |complete| {
                complete.complete(LogResult::problem("Log storage unavailable in this host"))
            },
        )
    }

    pub fn read(&self, complete: Callback<LogResult>) {
        self.read.run(LogComplete { complete });
    }

    pub fn clear(&self, complete: Callback<LogResult>) {
        self.clear.run(LogComplete { complete });
    }
}
