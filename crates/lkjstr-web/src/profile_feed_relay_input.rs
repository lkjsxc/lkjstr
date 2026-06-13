use lkjstr_app::{ProfileFeedDiagnosticInput, ProfileFeedSourceState, ProfileHeaderView};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::AuthorRelayRoute;

#[derive(Clone)]
pub(crate) struct ProfileRelayReadInput {
    pub(crate) owner: String,
    pub(crate) profile_pubkey: String,
    pub(crate) selected_relays: Vec<String>,
    pub(crate) profile_hint_relays: Vec<String>,
    pub(crate) relay_sets_json: String,
    pub(crate) author_routes: Vec<AuthorRelayRoute>,
    pub(crate) profile_header: Option<ProfileHeaderView>,
    pub(crate) cache_window: lkjstr_app::FeedWindowState,
    pub(crate) diagnostics: Vec<ProfileFeedDiagnosticInput>,
    pub(crate) since: u64,
    pub(crate) until: u64,
}

pub(crate) struct ProfileRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) profile_pubkey: &'a Option<String>,
    pub(crate) source_state: &'a ProfileFeedSourceState,
    pub(crate) selected_relays: &'a [String],
    pub(crate) profile_hint_relays: &'a [String],
    pub(crate) relay_sets_json: &'a str,
    pub(crate) author_routes: &'a [AuthorRelayRoute],
    pub(crate) profile_header: &'a Option<ProfileHeaderView>,
    pub(crate) window: &'a lkjstr_app::FeedWindowState,
    pub(crate) diagnostics: &'a [ProfileFeedDiagnosticInput],
    pub(crate) now_sec: u64,
}

pub(crate) fn profile_relay_input(
    seed: ProfileRelayInputSeed<'_>,
) -> Option<ProfileRelayReadInput> {
    if seed.source_state == &ProfileFeedSourceState::CacheComplete {
        return None;
    }
    if seed.source_state == &ProfileFeedSourceState::EmptyProven {
        return None;
    }
    if seed.selected_relays.is_empty() && seed.author_routes.is_empty() {
        return None;
    }
    let (since, until) = relay_range(seed.source_state, seed.now_sec);
    Some(ProfileRelayReadInput {
        owner: seed.owner.to_owned(),
        profile_pubkey: seed.profile_pubkey.clone()?,
        selected_relays: seed.selected_relays.to_vec(),
        profile_hint_relays: seed.profile_hint_relays.to_vec(),
        relay_sets_json: seed.relay_sets_json.to_owned(),
        author_routes: seed.author_routes.to_vec(),
        profile_header: seed.profile_header.clone(),
        cache_window: seed.window.clone(),
        diagnostics: seed.diagnostics.to_vec(),
        since,
        until,
    })
}

pub(crate) fn profile_event_matches_read(
    input: &ProfileRelayReadInput,
    event: &NostrEvent,
) -> bool {
    event.pubkey == input.profile_pubkey
        && matches!(
            event.kind,
            KIND_TEXT_NOTE | KIND_REPOST | KIND_GENERIC_REPOST
        )
        && event.created_at >= input.since
        && event.created_at < input.until
}

fn relay_range(source_state: &ProfileFeedSourceState, now_sec: u64) -> (u64, u64) {
    match source_state {
        ProfileFeedSourceState::SearchingOlder { since, until, .. } => (*since, *until),
        _ => (now_sec.saturating_sub(30), now_sec),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_app::{empty_feed_window, ProfileFeedSourceState};

    #[test]
    fn sparse_profile_relay_input_uses_planned_older_interval() -> Result<(), String> {
        let source_state = ProfileFeedSourceState::SearchingOlder {
            since: 100,
            until: 160,
            span_seconds: 60,
        };
        let Some(input) = profile_relay_input(ProfileRelayInputSeed {
            owner: "profile-tab",
            profile_pubkey: &Some(pubkey()),
            source_state: &source_state,
            selected_relays: &["wss://selected.example".to_owned()],
            profile_hint_relays: &["wss://selected.example".to_owned()],
            relay_sets_json: "[]",
            author_routes: &[],
            profile_header: &None,
            window: &empty_feed_window(1, 180),
            diagnostics: &[],
            now_sec: 1_700_000_000,
        }) else {
            return Err("expected sparse relay input".to_owned());
        };

        assert_eq!((input.since, input.until), (100, 160));
        assert!(profile_event_matches_read(&input, &event(159)));
        assert!(!profile_event_matches_read(&input, &event(160)));
        Ok(())
    }

    fn event(created_at: u64) -> lkjstr_protocol::NostrEvent {
        lkjstr_protocol::NostrEvent {
            id: "1".repeat(64),
            pubkey: pubkey(),
            created_at,
            kind: lkjstr_protocol::KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "note".to_owned(),
            sig: "f".repeat(128),
        }
    }

    fn pubkey() -> String {
        "a".repeat(64)
    }
}
