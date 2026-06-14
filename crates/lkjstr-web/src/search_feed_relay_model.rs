use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, SearchFeedDiagnosticInput,
    SearchFeedSourceState, SearchFeedView, SearchFeedViewInput, build_search_feed_view,
    reduce_feed_window,
};
use lkjstr_relays::{DemandVisibility, ProgressiveReadSnapshot, ProgressiveReadStatus};

use crate::{
    search_feed_host::{PAGE_SIZE, diagnostic},
    search_feed_relay::relay_until,
    search_feed_relay_input::SearchRelayReadInput,
};

pub(crate) fn model_from_snapshot(
    input: &SearchRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> SearchFeedView {
    let source_state = source_state(&snapshot);
    let diagnostics = relay_diagnostics(input, &snapshot);
    let until = relay_until(input);
    let flags = FeedWindowFlags {
        has_older: snapshot.events.len() as u64 >= PAGE_SIZE,
        ..FeedWindowFlags::default()
    };
    let window = reduce_feed_window(
        input.cache_window.clone(),
        FeedWindowEvidence::Snapshot {
            generation: 1,
            snapshot,
            flags,
        },
    );
    build_search_feed_view(SearchFeedViewInput {
        owner: input.owner.clone(),
        submitted_query: Some(input.query.clone()),
        source_state,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: None,
        until: Some(until),
        now_sec: input.now_sec,
        page_size: PAGE_SIZE,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: input.geometry_models.clone(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    })
}

fn source_state(snapshot: &ProgressiveReadSnapshot) -> SearchFeedSourceState {
    match (snapshot.status, snapshot.events.is_empty()) {
        (
            ProgressiveReadStatus::Failed
            | ProgressiveReadStatus::Cancelled
            | ProgressiveReadStatus::Incomplete,
            true,
        ) => SearchFeedSourceState::Partial {
            reason: snapshot.reason.clone(),
            retry_available: true,
        },
        _ => SearchFeedSourceState::RelayProgressive,
    }
}

fn relay_diagnostics(
    input: &SearchRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Vec<SearchFeedDiagnosticInput> {
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
