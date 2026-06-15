use crate::feed_fragments::fragment_key;
use lkjstr_protocol::{ContentAttachment, content_url_spans};

use super::{FeedEventContentRow, FeedEventLink};

#[must_use]
pub fn inject_link_rows(
    rows: Vec<FeedEventContentRow>,
    event_id: &str,
    shape: &str,
    media_attachments: &[ContentAttachment],
) -> Vec<FeedEventContentRow> {
    let mut link_index = 0usize;
    rows.into_iter()
        .flat_map(|row| split_link_row(row, event_id, shape, media_attachments, &mut link_index))
        .collect()
}

fn split_link_row(
    row: FeedEventContentRow,
    event_id: &str,
    shape: &str,
    media_attachments: &[ContentAttachment],
    link_index: &mut usize,
) -> Vec<FeedEventContentRow> {
    let FeedEventContentRow::Text(text) = row else {
        return vec![row];
    };
    split_text_links(&text, event_id, shape, media_attachments, link_index)
}

fn split_text_links(
    text: &str,
    event_id: &str,
    shape: &str,
    media_attachments: &[ContentAttachment],
    link_index: &mut usize,
) -> Vec<FeedEventContentRow> {
    let spans = content_url_spans(text);
    if spans.is_empty() {
        return vec![FeedEventContentRow::Text(text.to_owned())];
    }
    let mut rows = Vec::new();
    let mut cursor = 0;
    for span in spans {
        push_text(&mut rows, &text[cursor..span.start]);
        if !has_media_attachment(&span.url, media_attachments) {
            let item_index = next_link_index(link_index);
            rows.push(FeedEventContentRow::Link(FeedEventLink {
                row_key: fragment_key(event_id, shape, "event-link", item_index),
                item_index,
                text: span.url.clone(),
                url: span.url,
            }));
        }
        cursor = span.end;
    }
    push_text(&mut rows, &text[cursor..]);
    rows
}

fn has_media_attachment(url: &str, media_attachments: &[ContentAttachment]) -> bool {
    media_attachments.iter().any(|item| item.url == url)
}

fn next_link_index(link_index: &mut usize) -> u16 {
    let item_index = (*link_index).min(usize::from(u16::MAX)) as u16;
    *link_index = (*link_index).saturating_add(1);
    item_index
}

fn push_text(rows: &mut Vec<FeedEventContentRow>, text: &str) {
    if text.is_empty() {
        return;
    }
    if let Some(FeedEventContentRow::Text(previous)) = rows.last_mut() {
        previous.push_str(text);
    } else {
        rows.push(FeedEventContentRow::Text(text.to_owned()));
    }
}
