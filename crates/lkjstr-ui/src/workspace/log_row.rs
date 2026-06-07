use leptos::prelude::*;
use lkjstr_storage::{AppLogRecord, redact_app_log_text};

pub(crate) fn log_row(record: AppLogRecord) -> impl IntoView {
    let created = record.created_at_ms.to_string();
    let area = record.area;
    let level = record.level;
    let code = record.code;
    let message = redact_app_log_text(&record.message);
    let context = redact_app_log_text(&record.context_json);
    view! {
        <tr>
            <td>{created}</td>
            <td>{level}</td>
            <td>{area}</td>
            <td>{code}</td>
            <td>{message}</td>
            <td>{context}</td>
        </tr>
    }
}
