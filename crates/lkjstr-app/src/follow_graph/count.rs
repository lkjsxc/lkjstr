#![doc = "Profile follow-count state reducer."]

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FollowCountEvidence {
    CacheMiss,
    RelayDiscoveryStarted,
    Known { count: usize },
    Incomplete,
    Unavailable,
    Failed,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FollowCountState {
    LoadingCache,
    DiscoveringRelays,
    Known { count: usize },
    KnownEmpty,
    Incomplete,
    Unavailable,
    Failed,
}

#[must_use]
pub fn reduce_follow_count(
    state: FollowCountState,
    evidence: FollowCountEvidence,
) -> FollowCountState {
    match evidence {
        FollowCountEvidence::CacheMiss => match state {
            FollowCountState::Known { .. } | FollowCountState::KnownEmpty => state,
            _ => FollowCountState::LoadingCache,
        },
        FollowCountEvidence::RelayDiscoveryStarted => match state {
            FollowCountState::Known { .. } | FollowCountState::KnownEmpty => state,
            _ => FollowCountState::DiscoveringRelays,
        },
        FollowCountEvidence::Known { count: 0 } => FollowCountState::KnownEmpty,
        FollowCountEvidence::Known { count } => FollowCountState::Known { count },
        FollowCountEvidence::Incomplete => FollowCountState::Incomplete,
        FollowCountEvidence::Unavailable => FollowCountState::Unavailable,
        FollowCountEvidence::Failed => FollowCountState::Failed,
    }
}

#[must_use]
pub const fn follow_count_label(state: FollowCountState) -> &'static str {
    match state {
        FollowCountState::LoadingCache => "Loading following...",
        FollowCountState::DiscoveringRelays => "Calculating following...",
        FollowCountState::Known { .. } => "following",
        FollowCountState::KnownEmpty => "0 following",
        FollowCountState::Incomplete => "Following incomplete",
        FollowCountState::Unavailable => "Following unavailable",
        FollowCountState::Failed => "Following failed",
    }
}
