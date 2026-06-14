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
