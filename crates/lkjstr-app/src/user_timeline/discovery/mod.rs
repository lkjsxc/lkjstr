#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum UserTimelineDiscoveryState {
    NotStarted,
    LoadingCache,
    LoadingSelectedRelays,
    LoadingTargetRoutes,
    LoadingNip65Routes,
    LoadingProvenanceRoutes,
    Partial,
    TargetPostsOnly,
    Incomplete,
    Failed,
    AuthRequired,
    RateLimited,
    Offline,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DiscoveryRouteSource {
    Selected,
    TargetRoutes,
    Nip65,
    Provenance,
    Discovery,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DiscoveryRouteOutcome {
    Pending,
    Attempted,
    Succeeded,
    Failed,
    AuthRequired,
    RateLimited,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DiscoveryRouteGroup {
    pub source: DiscoveryRouteSource,
    pub relays: Vec<String>,
    pub outcome: DiscoveryRouteOutcome,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserTimelineDiscoveryInput {
    pub groups: Vec<DiscoveryRouteGroup>,
    pub cache_checked: bool,
    pub follow_list_found: bool,
    pub target_posts_reachable: bool,
    pub offline: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserTimelineDiscoveryPlan {
    pub state: UserTimelineDiscoveryState,
    pub attempted_sources: Vec<DiscoveryRouteSource>,
    pub successful_sources: Vec<DiscoveryRouteSource>,
    pub failed_sources: Vec<DiscoveryRouteSource>,
    pub pending_sources: Vec<DiscoveryRouteSource>,
    pub reason_codes: Vec<&'static str>,
    pub retry_sources: Vec<DiscoveryRouteSource>,
    pub target_posts_only: bool,
}

#[must_use]
pub fn plan_user_timeline_discovery(
    input: &UserTimelineDiscoveryInput,
) -> UserTimelineDiscoveryPlan {
    if input.offline {
        return plan(input, UserTimelineDiscoveryState::Offline, &["offline"]);
    }
    if !input.cache_checked {
        return plan(input, UserTimelineDiscoveryState::LoadingCache, &[]);
    }
    if input.follow_list_found {
        return plan(input, UserTimelineDiscoveryState::Partial, &[]);
    }
    if let Some(state) = active_loading_state(&input.groups) {
        return plan(input, state, &[]);
    }
    if has_outcome(&input.groups, DiscoveryRouteOutcome::AuthRequired) {
        return plan(
            input,
            UserTimelineDiscoveryState::AuthRequired,
            &["auth-required"],
        );
    }
    if has_outcome(&input.groups, DiscoveryRouteOutcome::RateLimited) {
        return plan(
            input,
            UserTimelineDiscoveryState::RateLimited,
            &["rate-limited"],
        );
    }
    if input.target_posts_reachable {
        return plan(
            input,
            UserTimelineDiscoveryState::TargetPostsOnly,
            &["follow-list-missing"],
        );
    }
    if input.groups.iter().all(|group| group.relays.is_empty()) {
        return plan(
            input,
            UserTimelineDiscoveryState::Incomplete,
            &["no-route-groups"],
        );
    }
    if input
        .groups
        .iter()
        .all(|group| group.outcome == DiscoveryRouteOutcome::Failed)
    {
        return plan(
            input,
            UserTimelineDiscoveryState::Failed,
            &["all-routes-failed"],
        );
    }
    plan(
        input,
        UserTimelineDiscoveryState::Incomplete,
        &["incomplete-routes"],
    )
}

fn plan(
    input: &UserTimelineDiscoveryInput,
    state: UserTimelineDiscoveryState,
    reasons: &[&'static str],
) -> UserTimelineDiscoveryPlan {
    let target_posts_only = state == UserTimelineDiscoveryState::TargetPostsOnly;
    UserTimelineDiscoveryPlan {
        state,
        attempted_sources: sources(input, |outcome| {
            !matches!(outcome, DiscoveryRouteOutcome::Pending)
        }),
        successful_sources: sources(input, |outcome| outcome == DiscoveryRouteOutcome::Succeeded),
        failed_sources: sources(input, |outcome| {
            matches!(outcome, DiscoveryRouteOutcome::Failed)
        }),
        pending_sources: sources(input, |outcome| outcome == DiscoveryRouteOutcome::Pending),
        reason_codes: reasons.to_vec(),
        retry_sources: retry_sources(input),
        target_posts_only,
    }
}

fn active_loading_state(groups: &[DiscoveryRouteGroup]) -> Option<UserTimelineDiscoveryState> {
    groups
        .iter()
        .find(|group| group.outcome == DiscoveryRouteOutcome::Pending && !group.relays.is_empty())
        .map(|group| match group.source {
            DiscoveryRouteSource::Selected => UserTimelineDiscoveryState::LoadingSelectedRelays,
            DiscoveryRouteSource::TargetRoutes => UserTimelineDiscoveryState::LoadingTargetRoutes,
            DiscoveryRouteSource::Nip65 => UserTimelineDiscoveryState::LoadingNip65Routes,
            DiscoveryRouteSource::Provenance => UserTimelineDiscoveryState::LoadingProvenanceRoutes,
            DiscoveryRouteSource::Discovery => UserTimelineDiscoveryState::LoadingTargetRoutes,
        })
}

fn retry_sources(input: &UserTimelineDiscoveryInput) -> Vec<DiscoveryRouteSource> {
    input
        .groups
        .iter()
        .filter(|group| {
            matches!(
                group.outcome,
                DiscoveryRouteOutcome::Failed
                    | DiscoveryRouteOutcome::AuthRequired
                    | DiscoveryRouteOutcome::RateLimited
            )
        })
        .map(|group| group.source)
        .take(4)
        .collect()
}

fn sources(
    input: &UserTimelineDiscoveryInput,
    accept: impl Fn(DiscoveryRouteOutcome) -> bool,
) -> Vec<DiscoveryRouteSource> {
    input
        .groups
        .iter()
        .filter(|group| accept(group.outcome))
        .map(|group| group.source)
        .collect()
}

fn has_outcome(groups: &[DiscoveryRouteGroup], outcome: DiscoveryRouteOutcome) -> bool {
    groups.iter().any(|group| group.outcome == outcome)
}

#[cfg(test)]
mod tests;
