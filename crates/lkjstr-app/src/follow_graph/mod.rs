#![doc = "Pure target follow graph reducers."]

mod author_set;
mod read_plan;
mod state;

pub use author_set::{
    FollowListSummary, UserTimelineAuthorSet, author_set_hash, summarize_follow_list,
    target_posts_only_author_set, user_timeline_author_set,
};
pub use read_plan::FollowListReadPhase;
pub use state::TargetFollowListState;

#[cfg(test)]
mod tests {
    use lkjstr_protocol::{NostrEvent, kinds::KIND_FOLLOW_LIST};

    use super::{summarize_follow_list, user_timeline_author_set};

    #[test]
    fn summarizes_valid_follow_entries() {
        let event = event(vec![
            vec!["p".to_owned(), "a".repeat(64)],
            vec!["p".to_owned(), "bad".to_owned()],
            vec!["p".to_owned(), "a".repeat(64)],
            vec!["p".to_owned(), "b".repeat(64)],
        ]);
        let summary = summarize_follow_list(&event);
        assert_eq!(summary.following_count, 2);
        assert_eq!(summary.entries[0].pubkey, "a".repeat(64));
    }

    #[test]
    fn builds_target_author_set() {
        let target = "c".repeat(64);
        let event = event(vec![vec!["p".to_owned(), "a".repeat(64)]]);
        let set = user_timeline_author_set(&target, Some(&event));
        assert_eq!(set.authors, vec![target, "a".repeat(64)]);
    }

    fn event(tags: Vec<Vec<String>>) -> NostrEvent {
        NostrEvent {
            id: "d".repeat(64),
            pubkey: "c".repeat(64),
            created_at: 1,
            kind: KIND_FOLLOW_LIST,
            tags,
            content: String::new(),
            sig: "e".repeat(128),
        }
    }
}
