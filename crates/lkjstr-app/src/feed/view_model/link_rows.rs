use lkjstr_protocol::{ContentAttachmentKind, classify_url, content_url_spans};

use super::{FeedEventContentRow, FeedEventLink};

#[must_use]
pub fn inject_link_rows(rows: Vec<FeedEventContentRow>) -> Vec<FeedEventContentRow> {
    rows.into_iter().flat_map(split_link_row).collect()
}

fn split_link_row(row: FeedEventContentRow) -> Vec<FeedEventContentRow> {
    let FeedEventContentRow::Text(text) = row else {
        return vec![row];
    };
    split_text_links(&text)
}

fn split_text_links(text: &str) -> Vec<FeedEventContentRow> {
    let spans = content_url_spans(text);
    if spans.is_empty() {
        return vec![FeedEventContentRow::Text(text.to_owned())];
    }
    let mut rows = Vec::new();
    let mut cursor = 0;
    for span in spans {
        push_text(&mut rows, &text[cursor..span.start]);
        if matches!(classify_url(&span.url).kind, ContentAttachmentKind::Link) {
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
