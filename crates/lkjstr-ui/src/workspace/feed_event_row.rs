use leptos::prelude::*;
use lkjstr_app::{FeedEventRow, FeedVisualRow};

pub(crate) fn event_row(row: FeedEventRow, trailing: impl IntoView) -> impl IntoView {
    let event_id = row.event_id;
    let row_id = row.row_id;
    let author = compact_pubkey(&row.author_pubkey);
    let created_at = row.created_at;
    let content = event_content(
        row.has_content_warning,
        row.content_warning_reason,
        row.visual_rows,
    );
    view! {
        <article class="lkjstr-feed-row event" data-row-id=row_id data-event-id=event_id>
            <small>{format!("{author} created {created_at}")}</small>
            {content}
            {trailing}
        </article>
    }
}

#[derive(Debug, Eq, PartialEq)]
enum EventContentRows {
    Sensitive(Option<String>),
    Text(Vec<String>),
}

fn event_content(
    has_content_warning: bool,
    reason: Option<String>,
    rows: Vec<FeedVisualRow>,
) -> impl IntoView {
    match event_content_rows(has_content_warning, reason, rows) {
        EventContentRows::Sensitive(reason) => view! {
            <aside class="content-warning">
                <strong>"Sensitive content"</strong>
                {warning_reason(reason)}
            </aside>
        }
        .into_any(),
        EventContentRows::Text(rows) => view! {
            {rows.into_iter().map(|text| view! { <p>{text}</p> }).collect_view()}
        }
        .into_any(),
    }
}

fn event_content_rows(
    has_content_warning: bool,
    reason: Option<String>,
    rows: Vec<FeedVisualRow>,
) -> EventContentRows {
    if has_content_warning {
        return EventContentRows::Sensitive(reason.filter(|item| !item.trim().is_empty()));
    }
    EventContentRows::Text(event_text_rows(rows))
}

fn warning_reason(reason: Option<String>) -> impl IntoView {
    reason.map(|reason| view! { <span>{reason}</span> })
}

fn event_text_rows(rows: Vec<FeedVisualRow>) -> Vec<String> {
    rows.into_iter().filter_map(event_text).collect()
}

fn event_text(item: FeedVisualRow) -> Option<String> {
    match item {
        FeedVisualRow::EventFull(row) => Some(row.content),
        FeedVisualRow::EventTextSegment(row) => Some(row.text),
        FeedVisualRow::EventMediaSegment(row) => Some(format!("media segment {}", row.index)),
        FeedVisualRow::EventReferenceSegment(row) => {
            Some(format!("reference segment {}", row.index))
        }
        FeedVisualRow::EventHeader(_) | FeedVisualRow::EventActions(_) => None,
    }
}

fn compact_pubkey(pubkey: &str) -> String {
    let chars = pubkey.chars().collect::<Vec<_>>();
    if chars.len() <= 16 {
        return pubkey.to_owned();
    }
    let prefix = chars.iter().take(8).collect::<String>();
    let suffix = chars
        .iter()
        .skip(chars.len().saturating_sub(8))
        .collect::<String>();
    format!("{prefix}...{suffix}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_app::feed_fragments::{
        EventFullRow, EventIndexedRow, EventMarkerRow, EventTextSegmentRow,
    };

    #[test]
    fn event_text_rows_keep_renderable_fragments_in_order() {
        let rows = vec![
            FeedVisualRow::EventHeader(marker("event-header")),
            FeedVisualRow::EventFull(full("hello")),
            FeedVisualRow::EventTextSegment(segment(1, "world")),
            FeedVisualRow::EventMediaSegment(indexed(2)),
            FeedVisualRow::EventReferenceSegment(indexed(3)),
            FeedVisualRow::EventActions(marker("event-actions")),
        ];

        assert_eq!(
            event_text_rows(rows),
            vec![
                "hello".to_owned(),
                "world".to_owned(),
                "media segment 2".to_owned(),
                "reference segment 3".to_owned(),
            ]
        );
    }

    #[test]
    fn compact_pubkey_keeps_both_ends() {
        assert_eq!(compact_pubkey(&"a".repeat(64)), "aaaaaaaa...aaaaaaaa");
        assert_eq!(compact_pubkey("short"), "short");
    }

    #[test]
    fn content_warning_hides_event_text_rows() {
        assert_eq!(
            event_content_rows(
                true,
                Some("spoiler".to_owned()),
                vec![FeedVisualRow::EventFull(full("secret"))],
            ),
            EventContentRows::Sensitive(Some("spoiler".to_owned())),
        );
        assert_eq!(
            event_content_rows(
                false,
                Some("spoiler".to_owned()),
                vec![FeedVisualRow::EventFull(full("public"))],
            ),
            EventContentRows::Text(vec!["public".to_owned()]),
        );
    }

    fn full(content: &str) -> EventFullRow {
        EventFullRow {
            event_id: "event".to_owned(),
            row_key: format!("full-{content}"),
            content: content.to_owned(),
            relay_provenance: Vec::new(),
        }
    }

    fn marker(row_key: &str) -> EventMarkerRow {
        EventMarkerRow {
            event_id: "event".to_owned(),
            row_key: row_key.to_owned(),
            relay_provenance: Vec::new(),
        }
    }

    fn segment(index: u16, text: &str) -> EventTextSegmentRow {
        EventTextSegmentRow {
            event_id: "event".to_owned(),
            row_key: format!("segment-{index}"),
            segment_index: index,
            text: text.to_owned(),
            starts_at: 0,
            ends_at: text.len(),
            relay_provenance: Vec::new(),
        }
    }

    fn indexed(index: u16) -> EventIndexedRow {
        EventIndexedRow {
            event_id: "event".to_owned(),
            row_key: format!("indexed-{index}"),
            index,
            relay_provenance: Vec::new(),
        }
    }
}
