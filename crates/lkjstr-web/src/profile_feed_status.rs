use lkjstr_app::{FeedDiagnosticSeverity, ProfileFeedDiagnosticInput};
use lkjstr_storage::StorageOutcome;

use crate::host_status::problem_status;

pub(crate) fn diagnostic(id: &str, message: &str) -> ProfileFeedDiagnosticInput {
    ProfileFeedDiagnosticInput {
        scope: "profile-provider".to_owned(),
        id: id.to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: message.to_owned(),
    }
}

pub(crate) fn storage_problem<T>(label: &str, outcome: StorageOutcome<T>) -> String {
    problem_status(label, outcome)
}
