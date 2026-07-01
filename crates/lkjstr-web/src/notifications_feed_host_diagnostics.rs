use lkjstr_app::{FeedDiagnosticSeverity, NotificationsFeedDiagnosticInput};

pub(crate) fn diagnostics(
    account: Option<String>,
    relay_message: Option<&str>,
) -> Vec<NotificationsFeedDiagnosticInput> {
    let mut out = account
        .map(|message| vec![diagnostic("active-account", &message)])
        .unwrap_or_default();
    if let Some(message) = relay_message {
        out.push(diagnostic("relay-settings", message));
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
