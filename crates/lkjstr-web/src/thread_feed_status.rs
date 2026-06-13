use lkjstr_app::{FeedDiagnosticSeverity, ThreadFeedDiagnosticInput};
use lkjstr_storage::StorageOutcome;

use crate::host_status::problem_status;

pub(crate) fn diagnostics(relays: &StorageOutcome<Vec<String>>) -> Vec<ThreadFeedDiagnosticInput> {
    let Some(problem) = relays.problem() else {
        return Vec::new();
    };
    vec![diagnostic(
        "relay-settings",
        &format!("Relay settings unavailable: {}", problem.reason),
    )]
}

pub(crate) fn diagnostic(id: &str, message: &str) -> ThreadFeedDiagnosticInput {
    ThreadFeedDiagnosticInput {
        scope: "thread-provider".to_owned(),
        id: id.to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: message.to_owned(),
    }
}

pub(crate) fn storage_problem<T>(label: &str, outcome: StorageOutcome<T>) -> String {
    problem_status(label, outcome)
}
