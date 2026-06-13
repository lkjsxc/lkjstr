use crate::thread_feed_relay_input::{ThreadRelayReadInput, ThreadRelayReadPhase};

pub(crate) fn thread_live_relay_input_from_state(
    input: &ThreadRelayReadInput,
    now_sec: u64,
) -> Option<ThreadRelayReadInput> {
    let since = input.cache_window.newest_cursor.as_ref()?.created_at;
    Some(ThreadRelayReadInput {
        since,
        until: now_sec.max(since),
        phase: ThreadRelayReadPhase::Live,
        ..input.clone()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_app::{FeedWindowEvidence, FeedWindowFlags, empty_feed_window, reduce_feed_window};
    use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
    use lkjstr_relays::ProgressiveEvent;

    #[test]
    fn live_input_starts_at_newest_loaded_thread_row() -> Result<(), String> {
        let Some(input) = thread_live_relay_input_from_state(&input(), 2_100) else {
            return Err("expected live input".to_owned());
        };

        assert_eq!(input.since, 2_000);
        assert_eq!(input.until, 2_100);
        assert_eq!(input.phase, ThreadRelayReadPhase::Live);
        Ok(())
    }

    fn input() -> ThreadRelayReadInput {
        ThreadRelayReadInput {
            owner: "thread-tab".to_owned(),
            event_id: id(2),
            root_event_id: id(1),
            root_author: None,
            selected_relays: vec!["wss://selected.example".to_owned()],
            author_routes: Vec::new(),
            cache_window: reduce_feed_window(
                empty_feed_window(1, 240),
                FeedWindowEvidence::Events {
                    generation: 1,
                    events: vec![progressive(2_000)],
                    flags: FeedWindowFlags::default(),
                },
            ),
            diagnostics: Vec::new(),
            since: 1_970,
            until: 2_000,
            phase: ThreadRelayReadPhase::Initial,
        }
    }

    fn progressive(created_at: u64) -> ProgressiveEvent {
        ProgressiveEvent {
            relays: vec!["wss://selected.example".to_owned()],
            sub_id: "thread".to_owned(),
            event: NostrEvent {
                id: id(created_at),
                pubkey: "a".repeat(64),
                created_at,
                kind: KIND_TEXT_NOTE,
                tags: Vec::new(),
                content: "thread event".to_owned(),
                sig: "c".repeat(128),
            },
        }
    }

    fn id(value: u64) -> String {
        format!("{value:064x}")
    }
}
