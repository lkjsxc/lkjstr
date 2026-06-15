use crate::feed_fragments::fragment_key;
use lkjstr_protocol::{CustomEmoji, custom_emoji_token_text};

use super::{FeedEventContentRow, FeedEventCustomEmoji};

pub(super) fn inject_custom_emoji_rows(
    rows: Vec<FeedEventContentRow>,
    event_id: &str,
    shape: &str,
    custom_emojis: &[CustomEmoji],
) -> Vec<FeedEventContentRow> {
    let mut emoji_index = 0usize;
    rows.into_iter()
        .flat_map(|row| split_text_row(row, event_id, shape, custom_emojis, &mut emoji_index))
        .collect()
}

fn split_text_row(
    row: FeedEventContentRow,
    event_id: &str,
    shape: &str,
    custom_emojis: &[CustomEmoji],
    emoji_index: &mut usize,
) -> Vec<FeedEventContentRow> {
    let FeedEventContentRow::Text(text) = row else {
        return vec![row];
    };
    split_custom_emoji_text(&text, event_id, shape, custom_emojis, emoji_index)
}

fn split_custom_emoji_text(
    text: &str,
    event_id: &str,
    shape: &str,
    custom_emojis: &[CustomEmoji],
    emoji_index: &mut usize,
) -> Vec<FeedEventContentRow> {
    let mut rows = Vec::new();
    let mut rest = text;
    while !rest.is_empty() {
        let Some((index, emoji)) = next_custom_emoji(rest, custom_emojis) else {
            rows.push(FeedEventContentRow::Text(rest.to_owned()));
            break;
        };
        if index > 0 {
            rows.push(FeedEventContentRow::Text(rest[..index].to_owned()));
        }
        rows.push(emoji_row(
            event_id,
            shape,
            next_emoji_index(emoji_index),
            emoji,
        ));
        rest = &rest[index + custom_emoji_token_text(&emoji.shortcode).len()..];
    }
    rows
}

fn next_custom_emoji<'a>(
    text: &str,
    custom_emojis: &'a [CustomEmoji],
) -> Option<(usize, &'a CustomEmoji)> {
    custom_emojis
        .iter()
        .filter_map(|emoji| {
            text.find(&custom_emoji_token_text(&emoji.shortcode))
                .map(|index| (index, emoji))
        })
        .min_by_key(|(index, _)| *index)
}

fn next_emoji_index(emoji_index: &mut usize) -> u16 {
    let item_index = (*emoji_index).min(usize::from(u16::MAX)) as u16;
    *emoji_index = (*emoji_index).saturating_add(1);
    item_index
}

fn emoji_row(
    event_id: &str,
    shape: &str,
    item_index: u16,
    emoji: &CustomEmoji,
) -> FeedEventContentRow {
    FeedEventContentRow::CustomEmoji(FeedEventCustomEmoji {
        row_key: fragment_key(event_id, shape, "event-custom-emoji", item_index),
        item_index,
        shortcode: emoji.shortcode.clone(),
        url: emoji.url.clone(),
        address: emoji.address.clone(),
    })
}
