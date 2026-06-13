use lkjstr_app::{
    AuthorContextFeedDiagnosticInput, AuthorContextFeedSourceState, AuthorContextFeedView,
    AuthorContextFeedViewInput, FeedDiagnosticSeverity, FeedFragmentConfig, FeedWindowEvidence,
    FeedWindowFlags, RowGeometryModel, build_author_context_feed_view, reduce_feed_window,
};
use lkjstr_relays::{DemandVisibility, ProgressiveReadSnapshot, ProgressiveReadStatus};

use crate::{
    author_context_host::PAGE_SIZE, author_context_relay_input::AuthorContextRelayReadInput,
};

pub(crate) fn model_from_snapshot(
    input: &AuthorContextRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> AuthorContextFeedView {
    let anchor_created_at = anchor_created_at(input, &snapshot);
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
    build_author_context_feed_view(AuthorContextFeedViewInput {
        owner: input.owner.clone(),
        event_id: Some(input.event_id.clone()),
        author_pubkey: Some(input.author_pubkey.clone()),
        source_state,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: Vec::new(),
        author_routes: input.author_routes.clone(),
        visibility: DemandVisibility::Visible,
        anchor_created_at,
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

fn anchor_created_at(
    input: &AuthorContextRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Option<u64> {
    input.anchor_created_at.or_else(|| {
        snapshot
            .events
            .iter()
            .find(|event| event.event.id == input.event_id)
            .map(|event| event.event.created_at)
    })
}

fn source_state(snapshot: &ProgressiveReadSnapshot) -> AuthorContextFeedSourceState {
    match (snapshot.status, snapshot.events.is_empty()) {
        (
            ProgressiveReadStatus::Failed
            | ProgressiveReadStatus::Cancelled
            | ProgressiveReadStatus::Incomplete,
            true,
        ) => AuthorContextFeedSourceState::Partial {
            reason: snapshot.reason.clone(),
            retry_available: true,
        },
        _ => AuthorContextFeedSourceState::RelayProgressive,
    }
}

fn relay_diagnostics(
    input: &AuthorContextRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Vec<AuthorContextFeedDiagnosticInput> {
    let mut out = input.diagnostics.clone();
    out.extend(snapshot.relays.iter().filter_map(|relay| {
        relay
            .reason
            .as_ref()
            .map(|reason| AuthorContextFeedDiagnosticInput {
                scope: "author-context-relay".to_owned(),
                id: format!("relay-{}", relay.relay),
                severity: FeedDiagnosticSeverity::Warning,
                message: format!("{}: {reason}", relay.relay),
            })
    }));
    out
}
