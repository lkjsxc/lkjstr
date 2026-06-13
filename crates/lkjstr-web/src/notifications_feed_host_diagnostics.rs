use lkjstr_app::{FeedDiagnosticSeverity, NotificationsFeedDiagnosticInput};
use lkjstr_storage::StorageOutcome;

pub(crate) fn diagnostics(
    account: Option<String>,
    relays: &StorageOutcome<Vec<String>>,
) -> Vec<NotificationsFeedDiagnosticInput> {
    let mut out = account
        .map(|message| vec![diagnostic("active-account", &message)])
        .unwrap_or_default();
    if let Some(problem) = relays.problem() {
        out.push(diagnostic(
            "relay-settings",
            &format!("Relay settings unavailable: {}", problem.reason),
        ));
    }
    out
}

pub(crate) fn diagnostic(id: &str, message: &str) -> NotificationsFeedDiagnosticInput {
    NotificationsFeedDiagnosticInput {
        scope: "notifications-provider".to_owned(),
        id: id.to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: message.to_owned(),
    }
}
