#![doc = "Pure target follow graph reducers."]

mod author_set;
mod count;
mod read_plan;
mod state;

pub use author_set::{
    FollowListSummary, UserTimelineAuthorSet, author_set_hash, summarize_follow_list,
    target_posts_only_author_set, user_timeline_author_set,
};
pub use count::{FollowCountEvidence, FollowCountState, follow_count_label, reduce_follow_count};
pub use read_plan::FollowListReadPhase;
pub use state::TargetFollowListState;

#[cfg(test)]
mod tests {
    use lkjstr_protocol::{NostrEvent, kinds::KIND_FOLLOW_LIST};

    use super::{
        FollowCountEvidence, FollowCountState, follow_count_label, reduce_follow_count,
        summarize_follow_list, user_timeline_author_set,
    };

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
    fn follow_count_never_turns_unknown_into_zero_without_kind3() {
        let state = reduce_follow_count(
            FollowCountState::LoadingCache,
            FollowCountEvidence::CacheMiss,
        );
        assert_eq!(state, FollowCountState::LoadingCache);
        let state = reduce_follow_count(state, FollowCountEvidence::RelayDiscoveryStarted);
        assert_eq!(state, FollowCountState::DiscoveringRelays);
        assert_eq!(follow_count_label(state), "Calculating following...");
    }

    #[test]
    fn follow_count_distinguishes_known_empty_and_incomplete() {
        assert_eq!(
            reduce_follow_count(
                FollowCountState::DiscoveringRelays,
                FollowCountEvidence::Known { count: 0 }
            ),
            FollowCountState::KnownEmpty
        );
        assert_eq!(
            reduce_follow_count(
                FollowCountState::DiscoveringRelays,
                FollowCountEvidence::Incomplete
            ),
            FollowCountState::Incomplete
        );
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
