#![doc = "Pure Tweet draft records."]

mod types;

pub use types::{
    TweetAttachment, TweetDraft, create_tweet_draft, empty_tweet_draft, tweet_draft_has_body,
    tweet_draft_id_for_tab,
};
