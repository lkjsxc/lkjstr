use leptos::prelude::*;
use lkjstr_app::FeedEventRow;

use crate::workspace::feed_event_content::event_content;

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

    #[test]
    fn compact_pubkey_keeps_both_ends() {
        assert_eq!(compact_pubkey(&"a".repeat(64)), "aaaaaaaa...aaaaaaaa");
        assert_eq!(compact_pubkey("short"), "short");
    }
}
