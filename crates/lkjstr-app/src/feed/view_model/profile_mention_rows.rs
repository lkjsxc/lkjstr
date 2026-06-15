use crate::feed_fragments::fragment_key;
use lkjstr_protocol::content_profile_mentions;

use super::{FeedEventContentRow, FeedEventProfileMention};

#[must_use]
pub fn inject_profile_mention_rows(
    rows: Vec<FeedEventContentRow>,
    event_id: &str,
    shape: &str,
) -> Vec<FeedEventContentRow> {
    let mut mention_index = 0usize;
    rows.into_iter()
        .flat_map(|row| split_profile_mentions(row, event_id, shape, &mut mention_index))
        .collect()
}

fn split_profile_mentions(
    row: FeedEventContentRow,
    event_id: &str,
    shape: &str,
    mention_index: &mut usize,
) -> Vec<FeedEventContentRow> {
    let FeedEventContentRow::Text(text) = row else {
        return vec![row];
    };
    let mentions = content_profile_mentions(&text);
    if mentions.is_empty() {
        return vec![FeedEventContentRow::Text(text)];
    }
    let mut rows = Vec::new();
    let mut cursor = 0;
    for mention in mentions {
        push_text(&mut rows, &text[cursor..mention.start]);
        let item_index = next_mention_index(mention_index);
        rows.push(FeedEventContentRow::ProfileMention(
            FeedEventProfileMention {
                row_key: fragment_key(event_id, shape, "event-profile-mention", item_index),
                item_index,
                pubkey: mention.pubkey,
                relays: mention.relays,
                raw_text: mention.raw,
            },
        ));
        cursor = mention.end;
    }
    push_text(&mut rows, &text[cursor..]);
    rows
}

fn next_mention_index(mention_index: &mut usize) -> u16 {
    let item_index = (*mention_index).min(usize::from(u16::MAX)) as u16;
    *mention_index = (*mention_index).saturating_add(1);
    item_index
}

fn push_text(rows: &mut Vec<FeedEventContentRow>, text: &str) {
    if !text.is_empty() {
        rows.push(FeedEventContentRow::Text(text.to_owned()));
    }
}
