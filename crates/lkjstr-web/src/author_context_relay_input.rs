use lkjstr_app::{AuthorContextFeedDiagnosticInput, AuthorContextFeedSourceState};
use lkjstr_protocol::{
    KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrEvent, NostrFilter, matches_any_filter,
};

const OLDER_LIMIT: u64 = 10;
const NEWER_LIMIT: u64 = 11;
pub(crate) const NEARBY_SECONDS: u64 = 86_400;

#[derive(Clone)]
pub(crate) struct AuthorContextRelayReadInput {
    pub(crate) owner: String,
    pub(crate) event_id: String,
    pub(crate) author_pubkey: String,
    pub(crate) selected_relays: Vec<String>,
    pub(crate) cache_window: lkjstr_app::FeedWindowState,
    pub(crate) diagnostics: Vec<AuthorContextFeedDiagnosticInput>,
    pub(crate) anchor_created_at: u64,
    pub(crate) now_sec: u64,
}

pub(crate) struct AuthorContextRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) event_id: &'a Option<String>,
    pub(crate) author_pubkey: &'a Option<String>,
    pub(crate) source_state: &'a AuthorContextFeedSourceState,
    pub(crate) selected_relays: &'a [String],
    pub(crate) window: &'a lkjstr_app::FeedWindowState,
    pub(crate) diagnostics: &'a [AuthorContextFeedDiagnosticInput],
    pub(crate) anchor_created_at: Option<u64>,
    pub(crate) now_sec: u64,
}

pub(crate) fn author_context_relay_input(
    seed: AuthorContextRelayInputSeed<'_>,
) -> Option<AuthorContextRelayReadInput> {
    if seed.source_state == &AuthorContextFeedSourceState::CacheComplete
        || seed.selected_relays.is_empty()
    {
        return None;
    }
    Some(AuthorContextRelayReadInput {
        owner: seed.owner.to_owned(),
        event_id: seed.event_id.clone()?,
        author_pubkey: seed.author_pubkey.clone()?,
        selected_relays: seed.selected_relays.to_vec(),
        cache_window: seed.window.clone(),
        diagnostics: seed.diagnostics.to_vec(),
        anchor_created_at: seed.anchor_created_at?,
        now_sec: seed.now_sec,
    })
}

pub(crate) fn author_context_relay_filters(
    input: &AuthorContextRelayReadInput,
) -> Vec<NostrFilter> {
    let lower = input.anchor_created_at.saturating_sub(NEARBY_SECONDS);
    let upper = input.anchor_created_at.saturating_add(NEARBY_SECONDS);
    vec![
        filter(
            &input.author_pubkey,
            Some(lower),
            Some(input.anchor_created_at),
            OLDER_LIMIT,
        ),
        filter(
            &input.author_pubkey,
            Some(input.anchor_created_at),
            Some(upper),
            NEWER_LIMIT,
        ),
    ]
}

pub(crate) fn author_context_event_matches_read(
    input: &AuthorContextRelayReadInput,
    event: &NostrEvent,
) -> bool {
    matches_any_filter(event, &author_context_relay_filters(input))
}

fn filter(author: &str, since: Option<u64>, until: Option<u64>, limit: u64) -> NostrFilter {
    NostrFilter {
        authors: Some(vec![author.to_owned()]),
        kinds: Some(display_kinds()),
        since,
        until,
        limit: Some(limit),
        ..NostrFilter::default()
    }
}

fn display_kinds() -> Vec<u64> {
    vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST]
}
