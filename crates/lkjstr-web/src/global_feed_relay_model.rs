use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, GlobalFeedDiagnosticInput,
    GlobalFeedSourceState, GlobalFeedView, GlobalFeedViewInput, GlobalOlderPageInput,
    GlobalOlderPageOutcome, build_global_feed_view, plan_global_older_page, reduce_feed_window,
};
use lkjstr_relays::{
    DemandVisibility, ProgressiveReadSnapshot, ProgressiveReadStatus,
    page_read::merge_progressive_events,
};

use crate::{
    global_feed_host::{PAGE_SIZE, diagnostic},
    global_feed_relay_input::{GlobalRelayReadInput, GlobalRelayReadPhase},
};

#[derive(Clone)]
pub(crate) struct GlobalRelayReadOutput {
    pub(crate) model: GlobalFeedView,
    pub(crate) input: GlobalRelayReadInput,
}

pub(crate) fn model_from_snapshot(
    input: &GlobalRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> GlobalFeedView {
    output_from_snapshot(input, snapshot).model
}

pub(crate) fn output_from_snapshot(
    input: &GlobalRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> GlobalRelayReadOutput {
    let source_state = source_state(&snapshot);
    let diagnostics = relay_diagnostics(input, &snapshot);
    let flags = window_flags(input, &snapshot);
    let window = reduce_feed_window(
        input.cache_window.clone(),
        FeedWindowEvidence::Snapshot {
            generation: 1,
            snapshot,
            flags,
        },
    );
    let next_input = next_input(input, &window, diagnostics.clone());
    let model = build_global_feed_view(GlobalFeedViewInput {
        owner: input.owner.clone(),
        source_state,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(input.now_sec.saturating_sub(30)),
        now_sec: input.now_sec,
        page_size: PAGE_SIZE,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: input.geometry_models.clone(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    GlobalRelayReadOutput {
        model,
        input: next_input,
    }
}

fn window_flags(input: &GlobalRelayReadInput, snapshot: &ProgressiveReadSnapshot) -> FeedWindowFlags {
    match &input.phase {
        GlobalRelayReadPhase::Initial => FeedWindowFlags {
            has_older: merged_oldest_created_at(input, snapshot).is_some(),
            ..FeedWindowFlags::default()
        },
        GlobalRelayReadPhase::Older { before } => FeedWindowFlags {
            has_older: older_page_outcome(input, snapshot, before.created_at).has_older,
            ..FeedWindowFlags::default()
        },
    }
}

fn next_input(
    input: &GlobalRelayReadInput,
    window: &lkjstr_app::FeedWindowState,
    diagnostics: Vec<GlobalFeedDiagnosticInput>,
) -> GlobalRelayReadInput {
    GlobalRelayReadInput {
        cache_window: window.clone(),
        diagnostics,
        ..input.clone()
    }
}

fn older_page_outcome(
    input: &GlobalRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
    cursor_created_at: u64,
) -> GlobalOlderPageOutcome {
    plan_global_older_page(GlobalOlderPageInput {
        older_cursor_created_at: cursor_created_at,
        merged_oldest_created_at: merged_oldest_created_at(input, snapshot),
        local_older_records_found: false,
        incoming_records_found: !snapshot.events.is_empty(),
        relay_read_complete: snapshot.status == ProgressiveReadStatus::Complete,
    })
}

fn merged_oldest_created_at(
    input: &GlobalRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Option<u64> {
    let current = input.cache_window.visible_events();
    merge_progressive_events(&current, &snapshot.events)
        .into_iter()
        .take(input.cache_window.max_items)
        .next_back()
        .map(|item| item.event.created_at)
}

fn source_state(snapshot: &ProgressiveReadSnapshot) -> GlobalFeedSourceState {
    match (snapshot.status, snapshot.events.is_empty()) {
        (
            ProgressiveReadStatus::Failed
            | ProgressiveReadStatus::Cancelled
            | ProgressiveReadStatus::Incomplete,
            true,
        ) => GlobalFeedSourceState::Partial {
            reason: snapshot.reason.clone(),
            retry_available: true,
        },
        _ => GlobalFeedSourceState::RelayProgressive,
    }
}

fn relay_diagnostics(
    input: &GlobalRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Vec<GlobalFeedDiagnosticInput> {
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
