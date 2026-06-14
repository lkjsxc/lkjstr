use lkjstr_app::{
    FeedWindowCursor, GlobalFeedDiagnosticInput, GlobalFeedSourceState, RowGeometryModel,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum GlobalRelayReadPhase {
    Initial,
    Older { before: FeedWindowCursor },
}

#[derive(Clone)]
pub(crate) struct GlobalRelayReadInput {
    pub(crate) owner: String,
    pub(crate) selected_relays: Vec<String>,
    pub(crate) cache_window: lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: Vec<RowGeometryModel>,
    pub(crate) diagnostics: Vec<GlobalFeedDiagnosticInput>,
    pub(crate) now_sec: u64,
    pub(crate) phase: GlobalRelayReadPhase,
}

#[derive(Clone, Copy)]
pub(crate) struct GlobalRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) source_state: &'a GlobalFeedSourceState,
    pub(crate) selected_relays: &'a [String],
    pub(crate) window: &'a lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: &'a [RowGeometryModel],
    pub(crate) diagnostics: &'a [GlobalFeedDiagnosticInput],
    pub(crate) now_sec: u64,
}

pub(crate) fn global_relay_input(seed: GlobalRelayInputSeed<'_>) -> Option<GlobalRelayReadInput> {
    if seed.source_state == &GlobalFeedSourceState::CacheComplete {
        return None;
    }
    global_base_relay_input(seed)
}

pub(crate) fn global_base_relay_input(
    seed: GlobalRelayInputSeed<'_>,
) -> Option<GlobalRelayReadInput> {
    if seed.selected_relays.is_empty() {
        return None;
    }
    Some(GlobalRelayReadInput {
        owner: seed.owner.to_owned(),
        selected_relays: seed.selected_relays.to_vec(),
        cache_window: seed.window.clone(),
        geometry_models: seed.geometry_models.to_vec(),
        diagnostics: seed.diagnostics.to_vec(),
        now_sec: seed.now_sec,
        phase: GlobalRelayReadPhase::Initial,
    })
}

pub(crate) fn global_older_relay_input_from_state(
    input: &GlobalRelayReadInput,
) -> Option<GlobalRelayReadInput> {
    let before = input.cache_window.oldest_cursor.clone()?;
    Some(GlobalRelayReadInput {
        phase: GlobalRelayReadPhase::Older { before },
        ..input.clone()
    })
}

pub(crate) fn global_event_matches_read(input: &GlobalRelayReadInput, event: &NostrEvent) -> bool {
    if event.kind != KIND_TEXT_NOTE {
        return false;
    }
    match &input.phase {
        GlobalRelayReadPhase::Initial => true,
        GlobalRelayReadPhase::Older { before } => event_before_cursor(event, before),
    }
}

fn event_before_cursor(event: &NostrEvent, before: &FeedWindowCursor) -> bool {
    event.created_at < before.created_at
        || (event.created_at == before.created_at && event.id > before.event_id)
}
