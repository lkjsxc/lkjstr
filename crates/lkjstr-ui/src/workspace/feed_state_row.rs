use leptos::prelude::*;
use lkjstr_app::{
    FeedContinuationRow, FeedDiagnosticRow, FeedNotificationRow, FeedProfileRow, FeedShellRow,
    FeedUnavailableRow,
};

pub(crate) fn unavailable(row: FeedUnavailableRow) -> impl IntoView {
    let row = unavailable_parts(row);
    text_row(row)
}

pub(crate) fn diagnostic(row: FeedDiagnosticRow) -> impl IntoView {
    let row = diagnostic_parts(row);
    text_row(row)
}

pub(crate) fn plain_continuation(row: FeedContinuationRow) -> impl IntoView {
    let row = continuation_parts(row);
    text_row(row)
}

pub(crate) fn profile(row: FeedProfileRow) -> impl IntoView {
    let row = profile_parts(row);
    text_row(row)
}

pub(crate) fn notification(row: FeedNotificationRow) -> impl IntoView {
    let row = notification_parts(row);
    text_row(row)
}

pub(crate) fn shell(row: FeedShellRow) -> impl IntoView {
    let height = row.reserved_height_px.to_string();
    let count = row.represented_row_count.to_string();
    let style = format!("min-height:{height}px;");
    view! {
        <article
            class="lkjstr-feed-row lod-shell"
            data-row-id=row.row_id
            data-lod-shell=""
            data-semantic-row-id=row.semantic_row_id
            data-reserved-height=height
            data-row-count=count
            data-route-group=row.route_group
            data-coverage=row.coverage
            style=style
        >
            <strong>"Compacted rows"</strong>
        </article>
    }
}

struct TextStateRow {
    class_name: &'static str,
    row_id: String,
    primary: String,
    detail: Option<String>,
}

fn text_row(row: TextStateRow) -> impl IntoView {
    let detail = row.detail;
    view! {
        <article class=row.class_name data-row-id=row.row_id>
            <strong>{row.primary}</strong>
            {detail.map(|text| view! { <p>{text}</p> })}
        </article>
    }
}

fn unavailable_parts(row: FeedUnavailableRow) -> TextStateRow {
    TextStateRow {
        class_name: "lkjstr-feed-row unavailable",
        row_id: row.row_id,
        primary: row.reason,
        detail: Some(row.detail),
    }
}

fn diagnostic_parts(row: FeedDiagnosticRow) -> TextStateRow {
    TextStateRow {
        class_name: "lkjstr-feed-row diagnostic",
        row_id: row.row_id,
        primary: format!("{:?}", row.severity),
        detail: Some(row.message),
    }
}

fn continuation_parts(row: FeedContinuationRow) -> TextStateRow {
    TextStateRow {
        class_name: "lkjstr-feed-row continuation",
        row_id: row.row_id,
        primary: format!("Continue thread ({})", row.hidden_count),
        detail: None,
    }
}

fn profile_parts(row: FeedProfileRow) -> TextStateRow {
    TextStateRow {
        class_name: "lkjstr-feed-row profile",
        row_id: row.row_id,
        primary: row.display_name,
        detail: None,
    }
}

fn notification_parts(row: FeedNotificationRow) -> TextStateRow {
    TextStateRow {
        class_name: "lkjstr-feed-row notification",
        row_id: row.row_id,
        primary: row.notification_kind,
        detail: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_app::FeedDiagnosticSeverity;

    #[test]
    fn unavailable_parts_preserve_reason_and_detail() {
        let row = unavailable_parts(FeedUnavailableRow {
            row_id: "unavailable-row".to_owned(),
            reason: "missing parent".to_owned(),
            subject: "event".to_owned(),
            detail: "relay did not return the event".to_owned(),
            retry_available: true,
        });

        assert_eq!(row.class_name, "lkjstr-feed-row unavailable");
        assert_eq!(row.row_id, "unavailable-row");
        assert_eq!(row.primary, "missing parent");
        assert_eq!(
            row.detail.as_deref(),
            Some("relay did not return the event")
        );
    }

    #[test]
    fn diagnostic_parts_keep_exact_severity_text() {
        let row = diagnostic_parts(FeedDiagnosticRow {
            row_id: "diagnostic-row".to_owned(),
            scope: "feed".to_owned(),
            diagnostic_id: "diag".to_owned(),
            severity: FeedDiagnosticSeverity::Warning,
            message: "partial relay failure".to_owned(),
        });

        assert_eq!(row.class_name, "lkjstr-feed-row diagnostic");
        assert_eq!(row.primary, "Warning");
        assert_eq!(row.detail.as_deref(), Some("partial relay failure"));
    }

    #[test]
    fn compact_state_rows_have_no_detail() {
        let continuation = continuation_parts(FeedContinuationRow {
            row_id: "continuation-row".to_owned(),
            target_event_id: "target".to_owned(),
            hidden_count: 4,
            depth: 2,
        });
        let profile = profile_parts(FeedProfileRow {
            row_id: "profile-row".to_owned(),
            pubkey: "pubkey".to_owned(),
            display_name: "Alice".to_owned(),
        });
        let notification = notification_parts(FeedNotificationRow {
            row_id: "notification-row".to_owned(),
            event_id: "event".to_owned(),
            notification_kind: "mention".to_owned(),
            source_event_id: None,
        });

        assert_eq!(continuation.primary, "Continue thread (4)");
        assert_eq!(profile.primary, "Alice");
        assert_eq!(notification.primary, "mention");
        assert!(continuation.detail.is_none());
        assert!(profile.detail.is_none());
        assert!(notification.detail.is_none());
    }
}
