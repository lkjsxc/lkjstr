use std::collections::BTreeMap;

use lkjstr_app::{
    DiscoveryRouteOutcome, FeedDiagnosticSeverity, FeedFragmentConfig, RowGeometryModel,
    UserTimelineFeedDiagnosticInput, UserTimelineFeedSourceState, UserTimelineFeedView,
    UserTimelineFeedViewInput, build_user_timeline_feed_view, empty_feed_window,
};
use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};
use lkjstr_storage::StorageOutcome;

use crate::{
    host_status::{browser_now_ms, problem_status},
    user_timeline_discovery_view::{discovery_plan, discovery_plan_for_relay_outcomes},
    user_timeline_host::{PAGE_SIZE, WINDOW_MAX},
    user_timeline_relay_diagnostics::relay_diagnostics,
    user_timeline_relay_outcome::UserTimelineRelayOutcome,
};

pub(crate) const PARTIAL_CACHE_REASON: &str =
    "Cached User Timeline rows loaded without complete coverage proof.";

pub(crate) struct UserTimelineModelParts<'a> {
    pub(crate) owner: &'a str,
    pub(crate) target_pubkey: Option<String>,
    pub(crate) discovery: lkjstr_app::UserTimelineDiscoveryPlan,
    pub(crate) author_set: Option<lkjstr_app::UserTimelineAuthorSet>,
    pub(crate) source_state: UserTimelineFeedSourceState,
    pub(crate) selected_relays: Vec<String>,
    pub(crate) author_routes: Vec<AuthorRelayRoute>,
    pub(crate) window: lkjstr_app::FeedWindowState,
    pub(crate) since: Option<u64>,
    pub(crate) geometry_models: Vec<RowGeometryModel>,
    pub(crate) diagnostics: Vec<UserTimelineFeedDiagnosticInput>,
}

pub(crate) fn loading_selected_model(
    owner: &str,
    target_pubkey: Option<String>,
    selected_relays: &[String],
    author_routes: &[AuthorRelayRoute],
    diagnostics: Vec<UserTimelineFeedDiagnosticInput>,
) -> UserTimelineFeedView {
    user_timeline_view(UserTimelineModelParts {
        owner,
        target_pubkey,
        discovery: discovery_plan(
            selected_relays.to_vec(),
            author_routes,
            DiscoveryRouteOutcome::Pending,
            false,
        ),
        author_set: None,
        source_state: UserTimelineFeedSourceState::Pending,
        selected_relays: selected_relays.to_vec(),
        author_routes: author_routes.to_vec(),
        window: empty_feed_window(1, WINDOW_MAX),
        since: None,
        geometry_models: Vec::new(),
        diagnostics,
    })
}

pub(crate) fn partial_failure_view(
    owner: &str,
    target_pubkey: Option<String>,
    selected_relays: Vec<String>,
    author_routes: Vec<AuthorRelayRoute>,
    reason: String,
    diagnostics: Vec<UserTimelineFeedDiagnosticInput>,
) -> UserTimelineFeedView {
    user_timeline_view(UserTimelineModelParts {
        owner,
        target_pubkey,
        discovery: discovery_plan(
            selected_relays.clone(),
            &author_routes,
            DiscoveryRouteOutcome::Succeeded,
            true,
        ),
        author_set: None,
        source_state: UserTimelineFeedSourceState::Partial {
            reason,
            retry_available: true,
        },
        selected_relays,
        author_routes,
        window: empty_feed_window(1, WINDOW_MAX),
        since: None,
        geometry_models: Vec::new(),
        diagnostics,
    })
}

pub(crate) fn relay_failure_view(
    owner: &str,
    target_pubkey: Option<String>,
    selected_relays: Vec<String>,
    author_routes: Vec<AuthorRelayRoute>,
    relay_outcomes: BTreeMap<String, UserTimelineRelayOutcome>,
) -> UserTimelineFeedView {
    let diagnostics = relay_diagnostics(&selected_relays, &author_routes, &relay_outcomes);
    user_timeline_view(UserTimelineModelParts {
        owner,
        target_pubkey,
        discovery: discovery_plan_for_relay_outcomes(
            selected_relays.clone(),
            &author_routes,
            &relay_outcomes,
            false,
        ),
        author_set: None,
        source_state: UserTimelineFeedSourceState::Pending,
        selected_relays,
        author_routes,
        window: empty_feed_window(1, WINDOW_MAX),
        since: None,
        geometry_models: Vec::new(),
        diagnostics,
    })
}

pub(crate) fn user_timeline_view(input: UserTimelineModelParts<'_>) -> UserTimelineFeedView {
    build_user_timeline_feed_view(UserTimelineFeedViewInput {
        owner: input.owner.to_owned(),
        target_pubkey: input.target_pubkey,
        discovery: input.discovery,
        author_set: input.author_set,
        source_state: input.source_state,
        selected_relays: input.selected_relays,
        disabled_relays: Vec::new(),
        author_routes: input.author_routes,
        visibility: DemandVisibility::Visible,
        since: input.since,
        now_sec: browser_now_ms() / 1_000,
        page_size: PAGE_SIZE,
        window: input.window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: input.geometry_models,
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: input.diagnostics,
    })
}

pub(crate) fn diagnostics(message: Option<&str>) -> Vec<UserTimelineFeedDiagnosticInput> {
    message
        .map(|message| vec![diagnostic("relay-settings", message)])
        .unwrap_or_default()
}

pub(crate) fn diagnostic(id: &str, message: &str) -> UserTimelineFeedDiagnosticInput {
    UserTimelineFeedDiagnosticInput {
        scope: "user-timeline-provider".to_owned(),
        id: id.to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: message.to_owned(),
    }
}

pub(crate) fn storage_problem<T>(label: &str, outcome: StorageOutcome<T>) -> String {
    problem_status(label, outcome)
}
