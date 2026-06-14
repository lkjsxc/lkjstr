use lkjstr_app::{
    FeedFooterState, FeedViewRow, FeedWindowCursor, FeedWindowEvidence, FeedWindowFlags,
    empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{
    PageReadSurface, ProgressiveEvent, ProgressiveReadSnapshot, ProgressiveReadStatus,
};

use crate::{
    global_feed_relay::global_relay_plan,
    global_feed_relay_input::{
        GlobalRelayReadInput, GlobalRelayReadPhase, global_event_matches_read,
    },
    global_feed_relay_model::model_from_snapshot,
};

pub struct GlobalRelayPlanProbe {
    pub sub_id: String,
    pub until: Option<u64>,
    pub kinds: Option<Vec<u64>>,
    pub authors: Option<Vec<String>>,
}

pub struct GlobalRelayMatchProbe {
    pub older_timestamp: bool,
    pub same_second_after_cursor: bool,
    pub same_second_before_cursor: bool,
    pub unsupported_kind: bool,
}

pub fn older_relay_plan_probe() -> Option<GlobalRelayPlanProbe> {
    let plan = global_relay_plan(&input(GlobalRelayReadPhase::Older {
        before: cursor(2_000, 20),
    }))?;
    let filter = plan.filters.first()?;
    Some(GlobalRelayPlanProbe {
        sub_id: plan.sub_id,
        until: filter.until,
        kinds: filter.kinds.clone(),
        authors: filter.authors.clone(),
    })
}

pub fn global_match_probe() -> GlobalRelayMatchProbe {
    let input = input(GlobalRelayReadPhase::Older {
        before: cursor(2_000, 20),
    });
    GlobalRelayMatchProbe {
        older_timestamp: global_event_matches_read(&input, &event(1_999, 10, KIND_TEXT_NOTE)),
        same_second_after_cursor: global_event_matches_read(
            &input,
            &event(2_000, 21, KIND_TEXT_NOTE),
        ),
        same_second_before_cursor: global_event_matches_read(
            &input,
            &event(2_000, 19, KIND_TEXT_NOTE),
        ),
        unsupported_kind: global_event_matches_read(&input, &event(1_999, 10, 7)),
    }
}

pub fn full_page_footer_probe() -> Option<FeedFooterState> {
    let events = (0..30)
        .map(|index| progressive(1_900 - index, index))
        .collect::<Vec<_>>();
    let model = model_from_snapshot(
        &input(GlobalRelayReadPhase::Older {
            before: cursor(2_000, 20),
        }),
        snapshot(ProgressiveReadStatus::Complete, events),
    );
    match model.view_model.rows.last() {
        Some(FeedViewRow::Footer(row)) => Some(row.state),
        _ => None,
    }
}

fn input(phase: GlobalRelayReadPhase) -> GlobalRelayReadInput {
    GlobalRelayReadInput {
        owner: "global-tab".to_owned(),
        selected_relays: vec!["wss://selected.example".to_owned()],
        cache_window: reduce_feed_window(
            empty_feed_window(1, 180),
            FeedWindowEvidence::Events {
                generation: 1,
                events: vec![progressive(2_000, 20)],
                flags: FeedWindowFlags {
                    has_older: true,
                    ..FeedWindowFlags::default()
                },
            },
        ),
        geometry_models: Vec::new(),
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
        read_id: "global-older".to_owned(),
        surface: Some(PageReadSurface::Global),
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
        sub_id: "global".to_owned(),
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
        content: "global relay event".to_owned(),
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
