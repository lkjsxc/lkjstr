use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, ProfileFeedDiagnosticInput,
    ProfileFeedSourceState, ProfileFeedView, ProfileFeedViewInput, RowGeometryModel,
    build_profile_feed_view, reduce_feed_window,
};
use lkjstr_relays::{DemandVisibility, ProgressiveReadSnapshot, ProgressiveReadStatus};

use crate::{
    profile_feed_host::PAGE_SIZE,
    profile_feed_status::diagnostic,
    profile_feed_relay_input::ProfileRelayReadInput,
};

pub(crate) fn model_from_snapshot(
    input: &ProfileRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> ProfileFeedView {
    let source_state = source_state(input, &snapshot);
    let diagnostics = relay_diagnostics(input, &snapshot);
    let window = reduce_feed_window(
        input.cache_window.clone(),
        FeedWindowEvidence::Snapshot {
            generation: 1,
            snapshot,
            flags: FeedWindowFlags::default(),
        },
    );
    build_profile_feed_view(ProfileFeedViewInput {
        owner: input.owner.clone(),
        profile_pubkey: Some(input.profile_pubkey.clone()),
        profile_header: input.profile_header.clone(),
        source_state,
        selected_relays: input.selected_relays.clone(),
        profile_hint_relays: input.profile_hint_relays.clone(),
        relay_sets_json: input.relay_sets_json.clone(),
        disabled_relays: Vec::new(),
        author_routes: input.author_routes.clone(),
        visibility: DemandVisibility::Visible,
        since: Some(input.since),
        now_sec: input.until,
        page_size: PAGE_SIZE,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    })
}

fn source_state(
    input: &ProfileRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> ProfileFeedSourceState {
    match (snapshot.status, snapshot.events.is_empty()) {
        (ProgressiveReadStatus::Complete, true) => ProfileFeedSourceState::SearchingOlder {
            since: input.since,
            until: input.until,
            span_seconds: input.until.saturating_sub(input.since),
        },
        (
            ProgressiveReadStatus::Failed
            | ProgressiveReadStatus::Cancelled
            | ProgressiveReadStatus::Incomplete,
            true,
        ) => ProfileFeedSourceState::Partial {
            reason: snapshot.reason.clone(),
            retry_available: true,
        },
        _ => ProfileFeedSourceState::RelayProgressive,
    }
}

fn relay_diagnostics(
    input: &ProfileRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Vec<ProfileFeedDiagnosticInput> {
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
