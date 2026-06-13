use lkjstr_app::{
    FeedFooterState, FeedViewRow, FeedWindowCursor, FeedWindowEvidence, FeedWindowFlags,
    empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{
    PageReadSurface, ProgressiveEvent, ProgressiveReadSnapshot, ProgressiveReadStatus,
};

use crate::{
    search_feed_relay::search_relay_plan,
    search_feed_relay_input::{
        SearchRelayReadInput, SearchRelayReadPhase, search_event_matches_read,
    },
    search_feed_relay_model::model_from_snapshot,
};

pub struct SearchRelayPlanProbe {
    pub sub_id: String,
    pub until: Option<u64>,
    pub kinds: Option<Vec<u64>>,
    pub search: Option<String>,
}

pub struct SearchRelayMatchProbe {
    pub older_timestamp: bool,
    pub same_second_after_cursor: bool,
    pub same_second_before_cursor: bool,
    pub unsupported_kind: bool,
}

pub fn older_relay_plan_probe() -> Option<SearchRelayPlanProbe> {
    let plan = search_relay_plan(&input(SearchRelayReadPhase::Older {
        before: cursor(2_000, 20),
    }))?;
    let filter = plan.filters.first()?;
    Some(SearchRelayPlanProbe {
        sub_id: plan.sub_id,
        until: filter.until,
        kinds: filter.kinds.clone(),
        search: filter.search.clone(),
    })
}

pub fn search_match_probe() -> SearchRelayMatchProbe {
    let input = input(SearchRelayReadPhase::Older {
        before: cursor(2_000, 20),
    });
    SearchRelayMatchProbe {
        older_timestamp: search_event_matches_read(&input, &event(1_999, 10, KIND_TEXT_NOTE)),
        same_second_after_cursor: search_event_matches_read(
            &input,
            &event(2_000, 21, KIND_TEXT_NOTE),
        ),
        same_second_before_cursor: search_event_matches_read(
            &input,
            &event(2_000, 19, KIND_TEXT_NOTE),
        ),
        unsupported_kind: search_event_matches_read(&input, &event(1_999, 10, 7)),
    }
}

pub fn full_page_footer_probe() -> Option<FeedFooterState> {
    let events = (0..30)
        .map(|index| progressive(1_900 - index, index))
        .collect::<Vec<_>>();
    let model = model_from_snapshot(
        &input(SearchRelayReadPhase::Older {
            before: cursor(2_000, 20),
        }),
        snapshot(ProgressiveReadStatus::Complete, events),
    );
    match model.view_model.rows.last() {
        Some(FeedViewRow::Footer(row)) => Some(row.state),
        _ => None,
    }
}

fn input(phase: SearchRelayReadPhase) -> SearchRelayReadInput {
    SearchRelayReadInput {
        owner: "search-tab".to_owned(),
        query: "nostr wasm".to_owned(),
        selected_relays: vec!["wss://selected.example".to_owned()],
        cache_window: reduce_feed_window(
            empty_feed_window(1, 180),
            FeedWindowEvidence::Events {
                generation: 1,
                events: vec![progressive(2_000, 20)],
                flags: FeedWindowFlags::default(),
            },
        ),
        diagnostics: Vec::new(),
        now_sec: 2_100,
        phase,
    }
}

fn snapshot(
    status: ProgressiveReadStatus,
    events: Vec<ProgressiveEvent>,
) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "search-older".to_owned(),
        surface: Some(PageReadSurface::Search),
        status,
        reason: "test".to_owned(),
        events,
        relays: Vec::new(),
        started_at_ms: 1,
        updated_at_ms: 2,
        duration_ms: 1,
        final_read: true,
    }
}

fn progressive(created_at: u64, id: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "search".to_owned(),
        event: event(created_at, id, KIND_TEXT_NOTE),
    }
}

fn event(created_at: u64, id: u64, kind: u64) -> NostrEvent {
    NostrEvent {
        id: id_hex(id),
        pubkey: "a".repeat(64),
        created_at,
        kind,
        tags: Vec::new(),
        content: "nostr wasm search result".to_owned(),
        sig: "c".repeat(128),
    }
}

fn cursor(created_at: u64, id: u64) -> FeedWindowCursor {
    FeedWindowCursor {
        created_at,
        event_id: id_hex(id),
    }
}

fn id_hex(value: u64) -> String {
    format!("{value:064x}")
}
