use super::{
    state::user_timeline_target_only_notice, DiscoveryRouteSource, UserTimelineFeedStatus,
    UserTimelineFeedViewInput,
};

pub(super) const INCOMPLETE_DISCOVERY_REASON: &str = "incomplete-user-timeline-discovery";

#[must_use]
pub(super) fn user_timeline_status_detail(
    status: UserTimelineFeedStatus,
    input: &UserTimelineFeedViewInput,
) -> String {
    match status {
        UserTimelineFeedStatus::MissingPubkey => "User Timeline target unavailable.".to_owned(),
        UserTimelineFeedStatus::LoadingDiscovery => "Loading public timeline...".to_owned(),
        UserTimelineFeedStatus::LoadingFeed => "User Timeline loading.".to_owned(),
        UserTimelineFeedStatus::NoEnabledRelay => "User Timeline needs a relay.".to_owned(),
        UserTimelineFeedStatus::Ready => "User Timeline ready.".to_owned(),
        UserTimelineFeedStatus::TargetPostsOnly => "Target posts only.".to_owned(),
        UserTimelineFeedStatus::Partial => "User Timeline partial.".to_owned(),
        UserTimelineFeedStatus::Incomplete => incomplete_detail(input),
        UserTimelineFeedStatus::Failed => "User Timeline discovery failed.".to_owned(),
        UserTimelineFeedStatus::AuthRequired => "User Timeline relay auth required.".to_owned(),
        UserTimelineFeedStatus::RateLimited => "User Timeline relays rate limited.".to_owned(),
        UserTimelineFeedStatus::Offline => "User Timeline offline.".to_owned(),
    }
}

fn incomplete_detail(input: &UserTimelineFeedViewInput) -> String {
    let tried = source_list(&input.discovery.attempted_sources).map_or(
        "cache checked and no route groups available".to_owned(),
        |sources| format!("tried {sources}"),
    );
    let failed = source_list(&input.discovery.failed_sources);
    let pending = source_list(&input.discovery.pending_sources);
    let route_state = match (failed, pending) {
        (Some(failed), Some(pending)) => format!("{failed} failed; pending {pending}"),
        (Some(failed), None) => format!("{failed} failed; no pending routes remain"),
        (None, Some(pending)) => format!("pending {pending}"),
        (None, None) => "no route produced a follow-list event".to_owned(),
    };
    let target_state = if input.discovery.target_posts_only {
        user_timeline_target_only_notice().to_owned()
    } else {
        "target-only posts unavailable from attempted routes".to_owned()
    };
    format!(
        "Discovery incomplete: {tried}; {route_state}; {target_state}. Selected relays may be insufficient; retry or add target routes."
    )
}

fn source_list(sources: &[DiscoveryRouteSource]) -> Option<String> {
    let mut labels: Vec<_> = sources.iter().copied().map(source_label).collect();
    labels.sort_unstable();
    labels.dedup();
    match labels.as_slice() {
        [] => None,
        [one] => Some((*one).to_owned()),
        [first, second] => Some(format!("{first} and {second}")),
        _ => {
            let tail = labels.pop()?;
            Some(format!("{}, and {tail}", labels.join(", ")))
        }
    }
}

const fn source_label(source: DiscoveryRouteSource) -> &'static str {
    match source {
        DiscoveryRouteSource::Selected => "selected relays",
        DiscoveryRouteSource::TargetRoutes => "target routes",
        DiscoveryRouteSource::Nip65 => "NIP-65 routes",
        DiscoveryRouteSource::Provenance => "provenance routes",
        DiscoveryRouteSource::Discovery => "discovery routes",
    }
}
