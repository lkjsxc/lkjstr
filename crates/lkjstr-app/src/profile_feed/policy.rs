use crate::read_availability::surface_startup_policy::{
    SurfaceStartupAccount, SurfaceStartupCacheState, SurfaceStartupDecision, SurfaceStartupInput,
    SurfaceStartupRelayState, surface_startup_policy,
};

use super::{ProfileFeedSourceState, ProfileFeedViewInput};

#[must_use]
pub(super) fn profile_startup_decision(input: &ProfileFeedViewInput) -> SurfaceStartupDecision {
    surface_startup_policy(SurfaceStartupInput {
        account: SurfaceStartupAccount::PublicTarget {
            present: input.profile_pubkey.is_some(),
        },
        read_plan: input.read_plan.clone(),
        author_route_count: input.author_routes.len(),
        cache_state: cache_state(&input.source_state),
        relay_state: relay_state(&input.source_state),
        content_present: !input.window.visible_events().is_empty(),
    })
}

fn cache_state(source: &ProfileFeedSourceState) -> SurfaceStartupCacheState {
    match source {
        ProfileFeedSourceState::Pending | ProfileFeedSourceState::RelayProgressive => {
            SurfaceStartupCacheState::Pending
        }
        ProfileFeedSourceState::CacheComplete => SurfaceStartupCacheState::Complete {
            empty_is_proven: false,
        },
        ProfileFeedSourceState::EmptyProven => SurfaceStartupCacheState::Complete {
            empty_is_proven: true,
        },
        ProfileFeedSourceState::SearchingOlder { .. } => SurfaceStartupCacheState::Partial {
            retry_available: true,
        },
        ProfileFeedSourceState::Partial {
            retry_available, ..
        } => SurfaceStartupCacheState::Partial {
            retry_available: *retry_available,
        },
    }
}

fn relay_state(source: &ProfileFeedSourceState) -> SurfaceStartupRelayState {
    if source == &ProfileFeedSourceState::RelayProgressive {
        SurfaceStartupRelayState::Progressive
    } else {
        SurfaceStartupRelayState::NotStarted
    }
}
