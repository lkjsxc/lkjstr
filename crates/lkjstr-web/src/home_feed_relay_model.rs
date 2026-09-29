use lkjstr_app::{
    FeedFragmentConfig, HomeFeedDiagnosticInput,
    HomeFeedSourceState, HomeFeedView, HomeFeedViewInput, HomeFollowState,
    ProtectedAccountAvailability, build_home_feed_view,
    home_feed::paging::home_window_from_snapshot,
};
use lkjstr_relays::{DemandVisibility, ProgressiveReadSnapshot, ProgressiveReadStatus};

use crate::{
    home_feed_host::{PAGE_SIZE, diagnostic},
    home_feed_relay_input::HomeRelayReadInput,
};

pub(crate) struct HomeRelayReadOutput {
    pub(crate) input: HomeRelayReadInput,
    pub(crate) model: HomeFeedView,
    pub(crate) finished: bool,
}

pub(crate) fn output_from_snapshot(
    input: &HomeRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> HomeRelayReadOutput {
    let mut source_state = source_state(&snapshot);
    let mut diagnostics = relay_diagnostics(input, &snapshot);
    let window = home_window_from_snapshot(&input.cache_window, snapshot, input.before.as_ref());
    let finished = window.terminal;
    if input.before.is_some() && finished
        && window.oldest_cursor == input.cache_window.oldest_cursor
    {
        let reason = "Selected relays did not advance the bounded Home history read; older history remains unproven.";
        diagnostics.push(diagnostic("older-no-progress", reason));
        source_state = HomeFeedSourceState::Partial { reason: reason.to_owned(), retry_available: true };
    }
    let next_input = HomeRelayReadInput { cache_window: window.clone(), ..input.clone() };
    let model = build_home_feed_view(HomeFeedViewInput {
        owner: input.owner.clone(),
        account: ProtectedAccountAvailability::selected(input.active_pubkey.clone()),
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
        geometry_models: input.geometry_models.clone(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    HomeRelayReadOutput { input: next_input, model, finished }
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
