use leptos::prelude::*;
use lkjstr_app::{FeedEventRow, FeedVisualRow};

pub(crate) fn event_row(row: FeedEventRow, trailing: impl IntoView) -> impl IntoView {
    let event_id = row.event_id;
    let row_id = row.row_id;
    let created_at = row.created_at;
    let text_rows = event_text_rows(row.visual_rows);
    view! {
        <article class="lkjstr-feed-row event" data-row-id=row_id data-event-id=event_id>
            <small>{format!("created {created_at}")}</small>
            {text_rows.into_iter().map(|text| view! { <p>{text}</p> }).collect_view()}
            {trailing}
        </article>
    }
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
