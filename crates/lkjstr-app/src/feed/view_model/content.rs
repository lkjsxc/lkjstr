use crate::feed_fragments::FeedVisualRow;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedEventContent {
    Sensitive {
        reason: Option<String>,
        rows: Vec<FeedEventContentRow>,
    },
    Rows(Vec<FeedEventContentRow>),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedEventContentRow {
    Text(String),
    MediaPreviewUnavailable,
    ReferencePreviewUnavailable,
}

impl FeedEventContentRow {
    #[must_use]
    pub fn text(&self) -> &str {
        match self {
            Self::Text(text) => text,
            Self::MediaPreviewUnavailable => "Media preview unavailable",
            Self::ReferencePreviewUnavailable => "Reference preview unavailable",
        }
    }
}

#[must_use]
pub fn feed_event_content(
    has_content_warning: bool,
    reason: Option<String>,
    rows: &[FeedVisualRow],
) -> FeedEventContent {
    let rows = feed_event_content_rows(rows);
    if has_content_warning {
        return FeedEventContent::Sensitive {
            reason: reason.filter(|item| !item.trim().is_empty()),
            rows,
        };
    }
    FeedEventContent::Rows(rows)
}

#[must_use]
pub fn feed_event_content_rows(rows: &[FeedVisualRow]) -> Vec<FeedEventContentRow> {
    rows.iter().filter_map(feed_event_content_row).collect()
}

fn feed_event_content_row(row: &FeedVisualRow) -> Option<FeedEventContentRow> {
    match row {
        FeedVisualRow::EventFull(row) => Some(FeedEventContentRow::Text(row.content.clone())),
        FeedVisualRow::EventTextSegment(row) => Some(FeedEventContentRow::Text(row.text.clone())),
        FeedVisualRow::EventMediaSegment(_) => Some(FeedEventContentRow::MediaPreviewUnavailable),
        FeedVisualRow::EventReferenceSegment(_) => {
            Some(FeedEventContentRow::ReferencePreviewUnavailable)
        }
        FeedVisualRow::EventHeader(_) | FeedVisualRow::EventActions(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::feed_fragments::{
        EventFullRow, EventIndexedRow, EventMarkerRow, EventTextSegmentRow,
    };

    #[test]
    fn content_rows_keep_renderable_fragments_in_order() {
        let rows = vec![
            FeedVisualRow::EventHeader(marker("event-header")),
            FeedVisualRow::EventFull(full("hello")),
            FeedVisualRow::EventTextSegment(segment(1, "world")),
            FeedVisualRow::EventMediaSegment(indexed(2)),
            FeedVisualRow::EventReferenceSegment(indexed(3)),
            FeedVisualRow::EventActions(marker("event-actions")),
        ];

        assert_eq!(
            feed_event_content_rows(&rows),
            vec![
                FeedEventContentRow::Text("hello".to_owned()),
                FeedEventContentRow::Text("world".to_owned()),
                FeedEventContentRow::MediaPreviewUnavailable,
                FeedEventContentRow::ReferencePreviewUnavailable,
            ]
        );
    }

    #[test]
    fn content_warning_keeps_rows_for_local_reveal() {
        assert_eq!(
            feed_event_content(
                true,
                Some("spoiler".to_owned()),
                &[FeedVisualRow::EventFull(full("secret"))],
            ),
            FeedEventContent::Sensitive {
                reason: Some("spoiler".to_owned()),
                rows: vec![FeedEventContentRow::Text("secret".to_owned())],
            },
        );
        assert_eq!(
            feed_event_content(
                false,
                Some("ignored".to_owned()),
                &[FeedVisualRow::EventFull(full("public"))],
            ),
            FeedEventContent::Rows(vec![FeedEventContentRow::Text("public".to_owned())]),
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
