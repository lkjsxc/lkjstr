use std::collections::BTreeSet;

use lkjstr_app::{
    FeedFragmentConfig, ProfileFeedDiagnosticInput, ProfileFeedSourceState, ProfileFeedView,
    ProfileFeedViewInput, ProfileHeaderView, RowGeometryModel, build_profile_feed_view,
};
use lkjstr_protocol::{
    KIND_FOLLOW_LIST, KIND_METADATA, KIND_RELAY_LIST_METADATA, NostrEvent, NostrFilter,
};
use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};

use crate::profile_feed_host::PAGE_SIZE;

#[derive(Clone)]
pub(crate) struct ProfileHeaderRelayReadInput {
    pub(crate) owner: String,
    pub(crate) profile_pubkey: String,
    pub(crate) relays: Vec<String>,
    pub(crate) metadata_relays: Vec<String>,
    pub(crate) follow_relays: Vec<String>,
    pub(crate) view_selected_relays: Vec<String>,
    pub(crate) profile_hint_relays: Vec<String>,
    pub(crate) relay_sets_json: String,
    pub(crate) author_routes: Vec<AuthorRelayRoute>,
    pub(crate) profile_header: Option<ProfileHeaderView>,
    pub(crate) cache_window: lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: Vec<RowGeometryModel>,
    pub(crate) source_state: ProfileFeedSourceState,
    pub(crate) diagnostics: Vec<ProfileFeedDiagnosticInput>,
    pub(crate) now_sec: u64,
}

pub(crate) struct ProfileHeaderRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) profile_pubkey: &'a Option<String>,
    pub(crate) selected_relays: &'a [String],
    pub(crate) view_selected_relays: &'a [String],
    pub(crate) relay_sets_json: &'a str,
    pub(crate) author_routes: &'a [AuthorRelayRoute],
    pub(crate) profile_header: &'a Option<ProfileHeaderView>,
    pub(crate) window: &'a lkjstr_app::FeedWindowState,
    pub(crate) geometry_models: &'a [RowGeometryModel],
    pub(crate) source_state: &'a ProfileFeedSourceState,
    pub(crate) diagnostics: &'a [ProfileFeedDiagnosticInput],
    pub(crate) now_sec: u64,
}

pub(crate) fn profile_header_relay_input(
    seed: ProfileHeaderRelayInputSeed<'_>,
) -> Option<ProfileHeaderRelayReadInput> {
    let metadata_relays = metadata_relays(seed.selected_relays, seed.author_routes);
    let follow_relays = unique_sorted(seed.selected_relays.iter().cloned());
    let relays = relay_union(&metadata_relays, &follow_relays);
    if relays.is_empty() {
        return None;
    }
    Some(ProfileHeaderRelayReadInput {
        owner: seed.owner.to_owned(),
        profile_pubkey: seed.profile_pubkey.clone()?,
        relays,
        metadata_relays,
        follow_relays,
        view_selected_relays: seed.view_selected_relays.to_vec(),
        profile_hint_relays: seed.selected_relays.to_vec(),
        relay_sets_json: seed.relay_sets_json.to_owned(),
        author_routes: seed.author_routes.to_vec(),
        profile_header: seed.profile_header.clone(),
        cache_window: seed.window.clone(),
        geometry_models: seed.geometry_models.to_vec(),
        source_state: seed.source_state.clone(),
        diagnostics: seed.diagnostics.to_vec(),
        now_sec: seed.now_sec,
    })
}

pub(crate) fn profile_header_relay_filters(
    input: &ProfileHeaderRelayReadInput,
    relay: &str,
) -> Vec<NostrFilter> {
    let mut filters = Vec::new();
    if input.metadata_relays.iter().any(|item| item == relay) {
        filters.push(NostrFilter {
            authors: Some(vec![input.profile_pubkey.clone()]),
            kinds: Some(vec![KIND_METADATA, KIND_RELAY_LIST_METADATA]),
            limit: Some(2),
            ..NostrFilter::default()
        });
    }
    if input.follow_relays.iter().any(|item| item == relay) {
        filters.push(NostrFilter {
            authors: Some(vec![input.profile_pubkey.clone()]),
            kinds: Some(vec![KIND_FOLLOW_LIST]),
            limit: Some(1),
            ..NostrFilter::default()
        });
    }
    filters
}

pub(crate) fn profile_header_event_matches_read(
    input: &ProfileHeaderRelayReadInput,
    event: &NostrEvent,
) -> bool {
    event.pubkey == input.profile_pubkey
        && matches!(
            event.kind,
            KIND_METADATA | KIND_FOLLOW_LIST | KIND_RELAY_LIST_METADATA
        )
}

pub(crate) fn profile_header_model(
    input: &ProfileHeaderRelayReadInput,
    profile_header: Option<ProfileHeaderView>,
    diagnostics: Vec<ProfileFeedDiagnosticInput>,
) -> ProfileFeedView {
    build_profile_feed_view(ProfileFeedViewInput {
        owner: input.owner.clone(),
        profile_pubkey: Some(input.profile_pubkey.clone()),
        profile_header: profile_header.or_else(|| input.profile_header.clone()),
        source_state: input.source_state.clone(),
        selected_relays: input.view_selected_relays.clone(),
        profile_hint_relays: input.profile_hint_relays.clone(),
        relay_sets_json: input.relay_sets_json.clone(),
        disabled_relays: Vec::new(),
        author_routes: input.author_routes.clone(),
        visibility: DemandVisibility::Visible,
        since: Some(input.now_sec.saturating_sub(30)),
        now_sec: input.now_sec,
        page_size: PAGE_SIZE,
        window: input.cache_window.clone(),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: input.geometry_models.clone(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    })
}

fn metadata_relays(selected: &[String], routes: &[AuthorRelayRoute]) -> Vec<String> {
    if routes.is_empty() {
        return unique_sorted(selected.iter().cloned());
    }
    unique_sorted(routes.iter().map(|route| route.relay_url.clone()))
}

fn relay_union(left: &[String], right: &[String]) -> Vec<String> {
    unique_sorted(left.iter().cloned().chain(right.iter().cloned()))
}

fn unique_sorted(values: impl Iterator<Item = String>) -> Vec<String> {
    values.collect::<BTreeSet<_>>().into_iter().collect()
}

#[cfg(test)]
mod tests;
