use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, ProfileFeedDiagnosticInput,
    ProfileFeedSourceState, ProfileFeedView, ProfileFeedViewInput, build_profile_feed_view,
    reduce_feed_window,
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
        geometry_models: input.geometry_models.clone(),
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

#[cfg(test)]
mod tests {
    use lkjstr_app::{FeedViewRow, ProfileFeedStatus, empty_feed_window};
    use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
    use lkjstr_relays::{PageReadSurface, ProgressiveEvent, ProgressiveReadStatus};

    use super::*;

    #[test]
    fn relay_event_renders_after_profile_cache_unavailable() {
        let input = ProfileRelayReadInput {
            owner: "profile-tab".to_owned(),
            profile_pubkey: pubkey(),
            selected_relays: vec!["wss://selected.example".to_owned()],
            profile_hint_relays: vec!["wss://selected.example".to_owned()],
            relay_sets_json: "[]".to_owned(),
            author_routes: Vec::new(),
            profile_header: None,
            cache_window: empty_feed_window(1, 180),
            geometry_models: Vec::new(),
            diagnostics: vec![diagnostic(
                "cache-events",
                "Cached Profile events unavailable: broker-missing",
            )],
            since: 1_699_999_970,
            until: 1_700_000_000,
        };
        let model = model_from_snapshot(&input, snapshot(event("relay profile note")));

        assert_eq!(model.status, ProfileFeedStatus::Ready);
        assert!(model.view_model.rows.iter().any(|row| {
            matches!(row, FeedViewRow::Event(event) if event.event_id == "1".repeat(64))
        }));
        assert!(model.view_model.rows.iter().any(|row| {
            matches!(row, FeedViewRow::Diagnostic(item) if item.message.contains("Cached Profile events unavailable"))
        }));
    }

    fn snapshot(event: NostrEvent) -> lkjstr_relays::ProgressiveReadSnapshot {
        lkjstr_relays::ProgressiveReadSnapshot {
            read_id: "profile-relay".to_owned(),
            surface: Some(PageReadSurface::Profile),
            status: ProgressiveReadStatus::Partial,
            reason: "relay-event".to_owned(),
            events: vec![ProgressiveEvent {
                relays: vec!["wss://selected.example".to_owned()],
                sub_id: "profile-relay".to_owned(),
                event,
            }],
            relays: Vec::new(),
            started_at_ms: 1,
            updated_at_ms: 2,
            duration_ms: 1,
            final_read: false,
        }
    }

    fn event(content: &str) -> NostrEvent {
        NostrEvent {
            id: "1".repeat(64),
            pubkey: pubkey(),
            created_at: 1_699_999_990,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: content.to_owned(),
            sig: "f".repeat(128),
        }
    }

    fn pubkey() -> String {
        "a".repeat(64)
    }
}
