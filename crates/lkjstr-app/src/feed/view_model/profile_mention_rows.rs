use lkjstr_protocol::content_profile_mentions;

use super::{FeedEventContentRow, FeedEventProfileMention};

#[must_use]
pub fn inject_profile_mention_rows(rows: Vec<FeedEventContentRow>) -> Vec<FeedEventContentRow> {
    rows.into_iter().flat_map(split_profile_mentions).collect()
}

fn split_profile_mentions(row: FeedEventContentRow) -> Vec<FeedEventContentRow> {
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
        rows.push(FeedEventContentRow::ProfileMention(
            FeedEventProfileMention {
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

fn push_text(rows: &mut Vec<FeedEventContentRow>, text: &str) {
    if !text.is_empty() {
        rows.push(FeedEventContentRow::Text(text.to_owned()));
    }
}
