use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, RowGeometryModel,
    ThreadFeedDiagnosticInput, ThreadFeedSourceState, ThreadFeedView, ThreadFeedViewInput,
    ThreadOlderPageInput, ThreadOlderPageOutcome, build_thread_feed_view,
    older_thread_cursor, plan_thread_older_page, reduce_feed_window,
};
use lkjstr_relays::{
    DemandVisibility, ProgressiveReadSnapshot, ProgressiveReadStatus,
    page_read::merge_progressive_events,
};

use crate::{
    thread_feed_host::PAGE_SIZE,
    thread_feed_relay_input::{ThreadRelayReadInput, ThreadRelayReadPhase},
    thread_feed_status::diagnostic,
    thread_feed_unavailable_parents::unavailable_parent_ids,
};

#[derive(Clone)]
pub(crate) struct ThreadRelayReadOutput {
    pub(crate) model: ThreadFeedView,
    pub(crate) input: ThreadRelayReadInput,
    pub(crate) start_live: bool,
}

pub(crate) fn output_from_snapshot(
    input: &ThreadRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> ThreadRelayReadOutput {
    let source_state = source_state(&snapshot);
    let diagnostics = relay_diagnostics(input, &snapshot);
    let flags = window_flags(input, &snapshot);
    let window = reduce_feed_window(
        input.cache_window.clone(),
        FeedWindowEvidence::Snapshot {
            generation: 1,
            snapshot: snapshot.clone(),
            flags,
        },
    );
    let next_input = next_input(input, &window, &snapshot, diagnostics.clone());
    let model = build_thread_feed_view(ThreadFeedViewInput {
        owner: input.owner.clone(),
        event_id: Some(input.event_id.clone()),
        root_event_id: Some(input.root_event_id.clone()),
        root_author: input.root_author.clone(),
        source_state,
        unavailable_parent_ids: unavailable_parent_ids(input, &window, &snapshot),
        selected_relays: input.selected_relays.clone(),
        disabled_relays: Vec::new(),
        author_routes: input.author_routes.clone(),
        visibility: DemandVisibility::Visible,
        since: Some(input.since),
        until: Some(input.until),
        now_sec: input.until,
        page_size: PAGE_SIZE,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    ThreadRelayReadOutput {
        model,
        input: next_input,
        start_live: start_live(input, &snapshot),
    }
}

fn window_flags(
    input: &ThreadRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> FeedWindowFlags {
    match input.phase {
        ThreadRelayReadPhase::Initial => FeedWindowFlags {
            has_older: merged_oldest_created_at(input, snapshot).is_some(),
            ..FeedWindowFlags::default()
        },
        ThreadRelayReadPhase::Live => FeedWindowFlags {
            has_older: input.cache_window.has_older,
            ..FeedWindowFlags::default()
        },
        ThreadRelayReadPhase::Older { cursor_created_at } => FeedWindowFlags {
            has_older: older_page_outcome(input, snapshot, cursor_created_at).has_older,
            ..FeedWindowFlags::default()
        },
    }
}

fn next_input(
    input: &ThreadRelayReadInput,
    window: &lkjstr_app::FeedWindowState,
    snapshot: &ProgressiveReadSnapshot,
    diagnostics: Vec<ThreadFeedDiagnosticInput>,
) -> ThreadRelayReadInput {
    let phase = next_phase(input, snapshot);
    let (since, until) = match phase {
        ThreadRelayReadPhase::Initial => (input.since, input.until),
        ThreadRelayReadPhase::Live => (input.since, input.until),
        ThreadRelayReadPhase::Older { cursor_created_at } => {
            let cursor = older_thread_cursor(cursor_created_at);
            (cursor.since, cursor.until)
        }
    };
    ThreadRelayReadInput {
        cache_window: window.clone(),
        diagnostics,
        phase,
        since,
        until,
        ..input.clone()
    }
}

fn next_phase(
    input: &ThreadRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> ThreadRelayReadPhase {
    match input.phase {
        ThreadRelayReadPhase::Initial => ThreadRelayReadPhase::Initial,
        ThreadRelayReadPhase::Live => ThreadRelayReadPhase::Live,
        ThreadRelayReadPhase::Older { cursor_created_at } => ThreadRelayReadPhase::Older {
            cursor_created_at: older_page_outcome(input, snapshot, cursor_created_at)
                .older_cursor_created_at,
        },
    }
}

fn older_page_outcome(
    input: &ThreadRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
    cursor_created_at: u64,
) -> ThreadOlderPageOutcome {
    plan_thread_older_page(ThreadOlderPageInput {
        older_cursor_created_at: cursor_created_at,
        merged_oldest_created_at: merged_oldest_created_at(input, snapshot),
        local_older_records_found: false,
        incoming_records_found: !snapshot.events.is_empty(),
        relay_read_complete: snapshot.status == ProgressiveReadStatus::Complete,
    })
}

fn merged_oldest_created_at(
    input: &ThreadRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Option<u64> {
    let current = input.cache_window.visible_events();
    merge_progressive_events(&current, &snapshot.events)
        .into_iter()
        .take(input.cache_window.max_items)
        .next_back()
        .map(|item| item.event.created_at)
}

fn source_state(snapshot: &ProgressiveReadSnapshot) -> ThreadFeedSourceState {
    match snapshot.status {
        ProgressiveReadStatus::Partial | ProgressiveReadStatus::CacheReady => {
            ThreadFeedSourceState::RelayProgressive
        }
        _ => ThreadFeedSourceState::Partial {
            reason: "Relay Thread bootstrap/page read finished; older/live Thread pages remain partial."
                .to_owned(),
            retry_available: true,
        },
    }
}

fn start_live(input: &ThreadRelayReadInput, snapshot: &ProgressiveReadSnapshot) -> bool {
    matches!(input.phase, ThreadRelayReadPhase::Initial)
        && snapshot.status == ProgressiveReadStatus::Complete
        && snapshot.final_read
}

fn relay_diagnostics(
    input: &ThreadRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Vec<ThreadFeedDiagnosticInput> {
    let mut out = input.diagnostics.clone();
    out.extend(snapshot.relays.iter().filter_map(|relay| {
        relay.reason.as_ref().map(|reason| {
            diagnostic(
                &format!("relay-{}", relay.relay),
                &format!("{}: {reason}", relay.relay),
            )
        })
    }));
    out
}
