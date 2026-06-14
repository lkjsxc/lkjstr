use lkjstr_app::{
    RowGeometryModel, ThreadFeedDiagnosticInput, ThreadFeedSourceState, older_thread_cursor,
};
use lkjstr_protocol::{
    KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrEvent, reply_root,
};
use lkjstr_relays::AuthorRelayRoute;

use crate::thread_feed_relay_exact::is_thread_exact_lookup;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum ThreadRelayReadPhase {
    Initial,
    Live,
    Older { cursor_created_at: u64 },
}

#[derive(Clone)]
pub(crate) struct ThreadRelayReadInput {
    pub(crate) owner: String,
    pub(crate) event_id: String,
    pub(crate) root_event_id: String,
    pub(crate) root_author: Option<String>,
    pub(crate) selected_relays: Vec<String>,
    pub(crate) author_routes: Vec<AuthorRelayRoute>,
    pub(crate) cache_window: lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: Vec<RowGeometryModel>,
    pub(crate) diagnostics: Vec<ThreadFeedDiagnosticInput>,
    pub(crate) since: u64,
    pub(crate) until: u64,
    pub(crate) phase: ThreadRelayReadPhase,
}

pub(crate) struct ThreadRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) event_id: &'a Option<String>,
    pub(crate) root_event_id: &'a Option<String>,
    pub(crate) root_author: &'a Option<String>,
    pub(crate) source_state: &'a ThreadFeedSourceState,
    pub(crate) selected_relays: &'a [String],
    pub(crate) author_routes: &'a [AuthorRelayRoute],
    pub(crate) window: &'a lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: &'a [RowGeometryModel],
    pub(crate) diagnostics: &'a [ThreadFeedDiagnosticInput],
    pub(crate) now_sec: u64,
}

pub(crate) fn thread_relay_input(
    seed: ThreadRelayInputSeed<'_>,
) -> Option<ThreadRelayReadInput> {
    if seed.source_state == &ThreadFeedSourceState::CacheComplete {
        return None;
    }
    if seed.selected_relays.is_empty() && seed.author_routes.is_empty() {
        return None;
    }
    let event_id = seed.event_id.clone()?;
    Some(ThreadRelayReadInput {
        owner: seed.owner.to_owned(),
        root_event_id: seed.root_event_id.clone().unwrap_or_else(|| event_id.clone()),
        event_id,
        root_author: seed.root_author.clone(),
        selected_relays: seed.selected_relays.to_vec(),
        author_routes: seed.author_routes.to_vec(),
        cache_window: seed.window.clone(),
        geometry_models: seed.geometry_models.to_vec(),
        diagnostics: seed.diagnostics.to_vec(),
        since: seed.now_sec.saturating_sub(30),
        until: seed.now_sec,
        phase: ThreadRelayReadPhase::Initial,
    })
}

pub(crate) fn thread_older_relay_input_from_state(
    input: &ThreadRelayReadInput,
) -> Option<ThreadRelayReadInput> {
    let cursor_created_at = thread_older_cursor_created_at(input)?;
    let cursor = older_thread_cursor(cursor_created_at);
    Some(ThreadRelayReadInput {
        since: cursor.since,
        until: cursor.until,
        phase: ThreadRelayReadPhase::Older { cursor_created_at },
        ..input.clone()
    })
}

pub(crate) fn thread_older_cursor_created_at(input: &ThreadRelayReadInput) -> Option<u64> {
    match input.phase {
        ThreadRelayReadPhase::Older { cursor_created_at } => Some(cursor_created_at),
        ThreadRelayReadPhase::Initial | ThreadRelayReadPhase::Live => input
            .cache_window
            .oldest_cursor
            .as_ref()
            .map(|cursor| cursor.created_at)
            .or(Some(input.since)),
    }
}

pub(crate) fn thread_event_matches_read(input: &ThreadRelayReadInput, event: &NostrEvent) -> bool {
    if matches!(input.phase, ThreadRelayReadPhase::Initial)
        && is_thread_exact_lookup(input, event)
    {
        return true;
    }
    matches!(
        event.kind,
        KIND_TEXT_NOTE | KIND_REPOST | KIND_GENERIC_REPOST
    ) && event.created_at >= input.since
        && event.created_at <= input.until
        && reply_root(event).is_some_and(|target| {
            target == input.root_event_id || target == input.event_id
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_app::empty_feed_window;
    use wasm_bindgen_test::wasm_bindgen_test;

    #[wasm_bindgen_test]
    fn thread_relay_input_uses_event_id_as_root_fallback() -> Result<(), String> {
        let Some(input) = thread_relay_input(ThreadRelayInputSeed {
            owner: "thread-tab",
            event_id: &Some(id("a")),
            root_event_id: &None,
            root_author: &None,
            source_state: &ThreadFeedSourceState::Pending,
            selected_relays: &["wss://selected.example".to_owned()],
            author_routes: &[],
            window: &empty_feed_window(1, 240),
            geometry_models: &[],
            diagnostics: &[],
            now_sec: 100,
        }) else {
            return Err("expected relay input".to_owned());
        };

        assert_eq!(input.root_event_id, id("a"));
        assert_eq!((input.since, input.until), (70, 100));
        Ok(())
    }

    #[wasm_bindgen_test]
    fn thread_event_match_accepts_root_and_recent_reply() {
        let input = read_input();

        assert!(thread_event_matches_read(&input, &event(&id("1"), 1, 50, vec![])));
        assert!(thread_event_matches_read(
            &input,
            &event(&id("2"), KIND_TEXT_NOTE, 80, root_tags())
        ));
        assert!(!thread_event_matches_read(
            &input,
            &event(&id("3"), KIND_TEXT_NOTE, 69, root_tags())
        ));
        assert!(!thread_event_matches_read(
            &input,
            &event(&id("4"), 0, 80, root_tags())
        ));
    }

    fn read_input() -> ThreadRelayReadInput {
        ThreadRelayReadInput {
            owner: "thread-tab".to_owned(),
            event_id: id("2"),
            root_event_id: id("1"),
            root_author: None,
            selected_relays: vec!["wss://selected.example".to_owned()],
            author_routes: Vec::new(),
            cache_window: empty_feed_window(1, 240),
            geometry_models: Vec::new(),
            diagnostics: Vec::new(),
            since: 70,
            until: 100,
            phase: ThreadRelayReadPhase::Initial,
        }
    }

    fn event(id: &str, kind: u64, created_at: u64, tags: Vec<Vec<String>>) -> NostrEvent {
        NostrEvent {
            id: id.to_owned(),
            pubkey: "a".repeat(64),
            created_at,
            kind,
            tags,
            content: "thread event".to_owned(),
            sig: "f".repeat(128),
        }
    }

    fn root_tags() -> Vec<Vec<String>> {
        vec![vec!["e".to_owned(), id("1"), String::new(), "root".to_owned()]]
    }

    fn id(prefix: &str) -> String {
        prefix.repeat(64)
    }
}
