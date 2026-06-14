use lkjstr_app::{
    FeedWindowCursor, RowGeometryModel, SearchFeedDiagnosticInput, SearchFeedSourceState,
};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrEvent};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum SearchRelayReadPhase {
    Initial,
    Older { before: FeedWindowCursor },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct SearchRelayReadInput {
    pub(crate) owner: String,
    pub(crate) query: String,
    pub(crate) selected_relays: Vec<String>,
    pub(crate) cache_window: lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: Vec<RowGeometryModel>,
    pub(crate) diagnostics: Vec<SearchFeedDiagnosticInput>,
    pub(crate) now_sec: u64,
    pub(crate) phase: SearchRelayReadPhase,
}

pub(crate) struct SearchRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) query: &'a str,
    pub(crate) source_state: &'a SearchFeedSourceState,
    pub(crate) selected_relays: &'a [String],
    pub(crate) window: &'a lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: &'a [RowGeometryModel],
    pub(crate) diagnostics: &'a [SearchFeedDiagnosticInput],
    pub(crate) now_sec: u64,
}

pub(crate) fn search_relay_input(seed: SearchRelayInputSeed<'_>) -> Option<SearchRelayReadInput> {
    let skip = seed.source_state == &SearchFeedSourceState::CacheComplete
        || seed.selected_relays.is_empty()
        || seed.query.trim().is_empty();
    if skip {
        return None;
    }
    Some(SearchRelayReadInput {
        owner: seed.owner.to_owned(),
        query: seed.query.trim().to_owned(),
        selected_relays: seed.selected_relays.to_vec(),
        cache_window: seed.window.clone(),
        geometry_models: seed.geometry_models.to_vec(),
        diagnostics: seed.diagnostics.to_vec(),
        now_sec: seed.now_sec,
        phase: SearchRelayReadPhase::Initial,
    })
}

pub(crate) fn search_event_matches_read(input: &SearchRelayReadInput, event: &NostrEvent) -> bool {
    if !display_kind(event.kind) {
        return false;
    }
    match &input.phase {
        SearchRelayReadPhase::Initial => true,
        SearchRelayReadPhase::Older { before } => event_before_cursor(event, before),
    }
}

fn display_kind(kind: u64) -> bool {
    matches!(kind, KIND_TEXT_NOTE | KIND_REPOST | KIND_GENERIC_REPOST)
}

fn event_before_cursor(event: &NostrEvent, before: &FeedWindowCursor) -> bool {
    event.created_at < before.created_at
        || (event.created_at == before.created_at && event.id > before.event_id)
}
