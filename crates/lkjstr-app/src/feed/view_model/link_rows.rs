use lkjstr_protocol::{ContentAttachment, content_url_spans};

use super::{FeedEventContentRow, FeedEventLink};

#[must_use]
pub fn inject_link_rows(
    rows: Vec<FeedEventContentRow>,
    media_attachments: &[ContentAttachment],
) -> Vec<FeedEventContentRow> {
    rows.into_iter()
        .flat_map(|row| split_link_row(row, media_attachments))
        .collect()
}

fn split_link_row(
    row: FeedEventContentRow,
    media_attachments: &[ContentAttachment],
) -> Vec<FeedEventContentRow> {
    let FeedEventContentRow::Text(text) = row else {
        return vec![row];
    };
    split_text_links(&text, media_attachments)
}

fn split_text_links(
    text: &str,
    media_attachments: &[ContentAttachment],
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
            rows.push(FeedEventContentRow::Link(FeedEventLink {
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
