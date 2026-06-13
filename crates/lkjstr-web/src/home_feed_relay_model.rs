use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, HomeFeedDiagnosticInput,
    HomeFeedSourceState, HomeFeedView, HomeFeedViewInput, HomeFollowState, RowGeometryModel,
    build_home_feed_view, reduce_feed_window,
};
use lkjstr_relays::{DemandVisibility, ProgressiveReadSnapshot, ProgressiveReadStatus};

use crate::{
    home_feed_host::{PAGE_SIZE, diagnostic},
    home_feed_relay_input::HomeRelayReadInput,
};

pub(crate) fn model_from_snapshot(
    input: &HomeRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> HomeFeedView {
    let source_state = source_state(&snapshot);
    let diagnostics = relay_diagnostics(input, &snapshot);
    let window = reduce_feed_window(
        input.cache_window.clone(),
        FeedWindowEvidence::Snapshot {
            generation: 1,
            snapshot,
            flags: FeedWindowFlags::default(),
        },
    );
    build_home_feed_view(HomeFeedViewInput {
        owner: input.owner.clone(),
        active_pubkey: Some(input.active_pubkey.clone()),
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: input.follow_pubkeys.clone(),
        },
        source_state,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(input.now_sec.saturating_sub(30)),
        now_sec: input.now_sec,
        page_size: PAGE_SIZE,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    })
}

fn source_state(snapshot: &ProgressiveReadSnapshot) -> HomeFeedSourceState {
    match (snapshot.status, snapshot.events.is_empty()) {
        (
            ProgressiveReadStatus::Failed
            | ProgressiveReadStatus::Cancelled
            | ProgressiveReadStatus::Incomplete,
            true,
        ) => HomeFeedSourceState::Partial {
            reason: snapshot.reason.clone(),
            retry_available: true,
        },
        _ => HomeFeedSourceState::RelayProgressive,
    }
}

fn relay_diagnostics(
    input: &HomeRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Vec<HomeFeedDiagnosticInput> {
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
