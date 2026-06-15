use crate::feed_fragments::fragment_key;
use lkjstr_protocol::{ContentAttachment, ContentAttachmentKind};

use super::{FeedEventContentRow, FeedEventMediaAttachment, FeedEventMediaKind};

#[must_use]
pub fn inject_media_rows(
    rows: Vec<FeedEventContentRow>,
    event_id: &str,
    shape: &str,
    attachments: &[ContentAttachment],
    per_segment: u16,
) -> Vec<FeedEventContentRow> {
    let media = media_rows(event_id, shape, attachments);
    if media.is_empty() {
        return rows;
    }
    let mut inserted = false;
    let mut next = Vec::new();
    for row in rows {
        match row {
            FeedEventContentRow::MediaPreviewUnavailable(preview) => {
                inserted = true;
                next.extend(segment_media(&media, preview.segment_index, per_segment));
            }
            other => next.push(other),
        }
    }
    if !inserted {
        next.extend(media);
    }
    next
}

fn media_rows(
    event_id: &str,
    shape: &str,
    attachments: &[ContentAttachment],
) -> Vec<FeedEventContentRow> {
    let mut rows = Vec::new();
    for item in attachments {
        if let Some(row) = media_row(event_id, shape, rows.len(), item) {
            rows.push(row);
        }
    }
    rows
}

fn media_row(
    event_id: &str,
    shape: &str,
    index: usize,
    item: &ContentAttachment,
) -> Option<FeedEventContentRow> {
    let kind = match item.kind {
        ContentAttachmentKind::Image => FeedEventMediaKind::Image,
        ContentAttachmentKind::Video => FeedEventMediaKind::Video,
        ContentAttachmentKind::Audio => FeedEventMediaKind::Audio,
        ContentAttachmentKind::Link => return None,
    };
    let item_index = index.min(usize::from(u16::MAX)) as u16;
    Some(FeedEventContentRow::MediaAttachment(
        FeedEventMediaAttachment {
            row_key: fragment_key(event_id, shape, "event-media-attachment", item_index),
            item_index,
            url: item.url.clone(),
            kind,
            aspect_ratio: item.aspect_ratio.clone(),
        },
    ))
}

fn segment_media(
    media: &[FeedEventContentRow],
    segment_index: u16,
    per_segment: u16,
) -> Vec<FeedEventContentRow> {
    let start = usize::from(segment_index) * usize::from(per_segment.max(1));
    let end = start.saturating_add(usize::from(per_segment.max(1)));
    media
        .iter()
        .skip(start)
        .take(end.saturating_sub(start))
        .cloned()
        .collect()
}
