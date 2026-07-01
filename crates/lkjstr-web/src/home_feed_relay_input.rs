use lkjstr_app::{
    HomeFeedDiagnosticInput, HomeFeedSourceState, HomeFollowState, RowGeometryModel,
};

#[derive(Clone)]
pub(crate) enum HomeRelayCommand {
    Follow(HomeFollowReadInput),
    Notes(HomeRelayReadInput),
}

#[derive(Clone)]
pub(crate) struct HomeFollowReadInput {
    pub(crate) owner: String,
    pub(crate) active_pubkey: String,
    pub(crate) selected_relays: Vec<String>,
    pub(crate) cache_window: lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: Vec<RowGeometryModel>,
    pub(crate) diagnostics: Vec<HomeFeedDiagnosticInput>,
    pub(crate) now_sec: u64,
}

#[derive(Clone)]
pub(crate) struct HomeRelayReadInput {
    pub(crate) owner: String,
    pub(crate) active_pubkey: String,
    pub(crate) follow_pubkeys: Vec<String>,
    pub(crate) selected_relays: Vec<String>,
    pub(crate) cache_window: lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: Vec<RowGeometryModel>,
    pub(crate) diagnostics: Vec<HomeFeedDiagnosticInput>,
    pub(crate) now_sec: u64,
}

pub(crate) struct HomeRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) active_pubkey: &'a Option<String>,
    pub(crate) follow_state: &'a HomeFollowState,
    pub(crate) source_state: &'a HomeFeedSourceState,
    pub(crate) selected_relays: &'a [String],
    pub(crate) window: &'a lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: &'a [RowGeometryModel],
    pub(crate) diagnostics: &'a [HomeFeedDiagnosticInput],
    pub(crate) now_sec: u64,
}

pub(crate) fn home_relay_input(seed: HomeRelayInputSeed<'_>) -> Option<HomeRelayCommand> {
    if seed.source_state == &HomeFeedSourceState::CacheComplete || seed.selected_relays.is_empty() {
        return None;
    }
    let active_pubkey = seed.active_pubkey.clone()?;
    match seed.follow_state {
        HomeFollowState::Loaded { follow_pubkeys } => Some(HomeRelayCommand::Notes(
            HomeRelayReadInput {
                owner: seed.owner.to_owned(),
                active_pubkey,
                follow_pubkeys: follow_pubkeys.clone(),
                selected_relays: seed.selected_relays.to_vec(),
                cache_window: seed.window.clone(),
                geometry_models: seed.geometry_models.to_vec(),
                diagnostics: seed.diagnostics.to_vec(),
                now_sec: seed.now_sec,
            },
        )),
        HomeFollowState::Loading => Some(HomeRelayCommand::Follow(HomeFollowReadInput {
            owner: seed.owner.to_owned(),
            active_pubkey,
            selected_relays: seed.selected_relays.to_vec(),
            cache_window: seed.window.clone(),
            geometry_models: seed.geometry_models.to_vec(),
            diagnostics: seed.diagnostics.to_vec(),
            now_sec: seed.now_sec,
        })),
        HomeFollowState::MissingComplete | HomeFollowState::Unavailable { .. } => None,
    }
}
