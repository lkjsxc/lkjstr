use lkjstr_app::{
    FeedFooterState, FeedViewRow, FeedWindowEvidence, FeedWindowFlags, empty_feed_window,
    reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{
    PageReadSurface, ProgressiveEvent, ProgressiveReadSnapshot, ProgressiveReadStatus,
};

use crate::thread_feed_relay::{ThreadRelayPlan, thread_relay_plan};
use crate::thread_feed_relay_input::{
    ThreadRelayReadInput, ThreadRelayReadPhase, thread_event_matches_read,
    thread_older_relay_input_from_state,
};
use crate::thread_feed_relay_live::thread_live_relay_input_from_state;
use crate::thread_feed_relay_model::output_from_snapshot;

pub struct ThreadRelayPlanProbe {
    pub sub_id: String,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub e_tags: Option<Vec<String>>,
    pub exact_ids: Vec<String>,
}

pub struct ThreadRelayOutputProbe {
    pub footer: Option<FeedFooterState>,
    pub unavailable_parent_count: usize,
    pub older_since: u64,
    pub older_until: u64,
    pub starts_live: bool,
}

pub struct ThreadRelayMatchProbe {
    pub accepted: bool,
    pub branch_reference: bool,
    pub before_window: bool,
    pub wrong_root: bool,
}

pub fn older_relay_plan_probe() -> Option<ThreadRelayPlanProbe> {
    let base = input(ThreadRelayReadPhase::Initial, 1_940, 2_120);
    let older = thread_older_relay_input_from_state(&base)?;
    relay_probe(thread_relay_plan(&older)?)
}

pub fn live_relay_plan_probe() -> Option<ThreadRelayPlanProbe> {
    let base = input(ThreadRelayReadPhase::Initial, 1_940, 2_120);
    let live = thread_live_relay_input_from_state(&base, 2_130)?;
    relay_probe(thread_relay_plan(&live)?)
}

pub fn initial_relay_plan_probe() -> Option<ThreadRelayPlanProbe> {
    relay_probe(thread_relay_plan(&input(
        ThreadRelayReadPhase::Initial,
        1_940,
        2_120,
    ))?)
}

fn relay_probe(plan: ThreadRelayPlan) -> Option<ThreadRelayPlanProbe> {
    let filter = plan
        .filters
        .iter()
        .find(|filter| !filter.tags.is_empty())
        .or_else(|| plan.filters.first())?;
    Some(ThreadRelayPlanProbe {
        sub_id: plan.sub_id,
        since: filter.since,
        until: filter.until,
        e_tags: filter.tags.get("e").cloned(),
        exact_ids: plan
            .filters
            .iter()
            .filter_map(|filter| filter.ids.as_ref()?.first().cloned())
            .collect(),
    })
}

pub fn thread_match_probe() -> ThreadRelayMatchProbe {
    let input = input(ThreadRelayReadPhase::Older { cursor_created_at: 2_000 }, 1_940, 1_999);
    ThreadRelayMatchProbe {
        accepted: thread_event_matches_read(&input, &event(1_980, true)),
        branch_reference: thread_event_matches_read(&input, &branch_event(1_980)),
        before_window: thread_event_matches_read(&input, &event(1_939, true)),
        wrong_root: thread_event_matches_read(&input, &event(1_980, false)),
    }
}

pub fn initial_complete_output_probe() -> Option<ThreadRelayOutputProbe> {
    let output = output_from_snapshot(
        &input(ThreadRelayReadPhase::Initial, 1_940, 2_120),
        snapshot(ProgressiveReadStatus::Complete, vec![progressive(2_000)]),
    );
    let older = thread_older_relay_input_from_state(&output.input)?;
    let footer = output.model.view_model.rows.last().and_then(|row| match row {
        FeedViewRow::Footer(row) => Some(row.state),
        _ => None,
    });
    Some(ThreadRelayOutputProbe {
        footer,
        unavailable_parent_count: unavailable_parent_count(&output.model),
        older_since: older.since,
        older_until: older.until,
        starts_live: output.start_live,
    })
}

fn unavailable_parent_count(model: &lkjstr_app::ThreadFeedView) -> usize {
    model
        .view_model
        .rows
        .iter()
        .filter(|row| {
            matches!(row, FeedViewRow::Unavailable(item) if item.reason == "thread-parent-unavailable")
        })
        .count()
}

fn input(phase: ThreadRelayReadPhase, since: u64, until: u64) -> ThreadRelayReadInput {
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
        since,
        until,
        phase,
    }
}

fn snapshot(
    status: ProgressiveReadStatus,
    events: Vec<ProgressiveEvent>,
) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "thread".to_owned(),
        surface: Some(PageReadSurface::Thread),
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

fn progressive(created_at: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "thread".to_owned(),
        event: event(created_at, true),
    }
}

fn event(created_at: u64, target_root: bool) -> NostrEvent {
    let tag_root = if target_root { id(1) } else { id(9) };
    NostrEvent {
        id: format!("{created_at:064x}"),
        pubkey: "a".repeat(64),
        created_at,
        kind: KIND_TEXT_NOTE,
        tags: vec![
            vec!["e".to_owned(), tag_root, String::new(), "root".to_owned()],
            vec!["e".to_owned(), id(5), String::new(), "reply".to_owned()],
        ],
        content: "thread event".to_owned(),
        sig: "c".repeat(128),
    }
}

fn branch_event(created_at: u64) -> NostrEvent {
    NostrEvent {
        id: format!("{created_at:064x}"),
        pubkey: "a".repeat(64),
        created_at,
        kind: KIND_TEXT_NOTE,
        tags: vec![vec!["e".to_owned(), id(2)]],
        content: "focused branch event".to_owned(),
        sig: "c".repeat(128),
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}
