use leptos::{ev::MouseEvent, prelude::*};
use lkjstr_app::FeedVisualRow;

#[derive(Clone, Debug, Eq, PartialEq)]
enum EventContentRows {
    Sensitive {
        reason: Option<String>,
        rows: Vec<String>,
    },
    Text(Vec<String>),
}

pub(crate) fn event_content(
    has_content_warning: bool,
    reason: Option<String>,
    rows: Vec<FeedVisualRow>,
) -> impl IntoView {
    match event_content_rows(has_content_warning, reason, rows) {
        EventContentRows::Sensitive { reason, rows } => sensitive_content(reason, rows).into_any(),
        EventContentRows::Text(rows) => text_rows_view(rows).into_any(),
    }
}

fn sensitive_content(reason: Option<String>, rows: Vec<String>) -> impl IntoView {
    let revealed = RwSignal::new(false);
    view! {
        {move || {
            if revealed.get() {
                text_rows_view(rows.clone()).into_any()
            } else {
                sensitive_warning(reason.clone(), revealed).into_any()
            }
        }}
    }
}

fn sensitive_warning(reason: Option<String>, revealed: RwSignal<bool>) -> impl IntoView {
    let reveal = move |_event: MouseEvent| revealed.set(true);
    view! {
        <aside class="content-warning">
            <strong>"Sensitive content"</strong>
            {warning_reason(reason)}
            <button type="button" on:click=reveal>"Reveal"</button>
        </aside>
    }
}

fn event_content_rows(
    has_content_warning: bool,
    reason: Option<String>,
    rows: Vec<FeedVisualRow>,
) -> EventContentRows {
    let rows = event_text_rows(rows);
    if has_content_warning {
        return EventContentRows::Sensitive {
            reason: reason.filter(|item| !item.trim().is_empty()),
            rows,
        };
    }
    EventContentRows::Text(rows)
}

fn warning_reason(reason: Option<String>) -> impl IntoView {
    reason.map(|reason| view! { <span>{reason}</span> })
}

fn text_rows_view(rows: Vec<String>) -> impl IntoView {
    rows.into_iter()
        .map(|text| view! { <p>{text}</p> })
        .collect_view()
}

fn event_text_rows(rows: Vec<FeedVisualRow>) -> Vec<String> {
    rows.into_iter().filter_map(event_text).collect()
}

fn event_text(item: FeedVisualRow) -> Option<String> {
    match item {
        FeedVisualRow::EventFull(row) => Some(row.content),
        FeedVisualRow::EventTextSegment(row) => Some(row.text),
        FeedVisualRow::EventMediaSegment(_) => Some("Media preview unavailable".to_owned()),
        FeedVisualRow::EventReferenceSegment(_) => Some("Reference preview unavailable".to_owned()),
        FeedVisualRow::EventHeader(_) | FeedVisualRow::EventActions(_) => None,
    }
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
                "Media preview unavailable".to_owned(),
                "Reference preview unavailable".to_owned(),
            ]
        );
    }

    #[test]
    fn content_warning_keeps_text_rows_for_reveal() {
        assert_eq!(
            event_content_rows(
                true,
                Some("spoiler".to_owned()),
                vec![FeedVisualRow::EventFull(full("secret"))],
            ),
            EventContentRows::Sensitive {
                reason: Some("spoiler".to_owned()),
                rows: vec!["secret".to_owned()],
            },
        );
        assert_eq!(
            event_content_rows(false, None, vec![FeedVisualRow::EventFull(full("public"))]),
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
