use lkjstr_app::{
    ProfileFeedSourceState, ProfileScanDecision, ProfileScanInput, plan_profile_sparse_scan,
};
use lkjstr_relays::AuthorRelayRoute;
use lkjstr_storage::FeedCoverageRecord;

use crate::profile_feed_coverage::{
    ProfileCoverageInput, profile_range_complete, profile_range_complete_empty,
};

const INITIAL_SPAN_SECONDS: u64 = 30;
const HISTORY_FLOOR: u64 = 0;
const MAX_SPARSE_STEPS: usize = 32;

pub(crate) struct ProfileSparseInput<'a> {
    pub(crate) owner: &'a str,
    pub(crate) profile_pubkey: &'a str,
    pub(crate) selected_relays: &'a [String],
    pub(crate) author_routes: &'a [AuthorRelayRoute],
    pub(crate) now_sec: u64,
    pub(crate) source_state: &'a ProfileFeedSourceState,
    pub(crate) current_window_empty: bool,
    pub(crate) coverage_rows: &'a [FeedCoverageRecord],
}

pub(crate) struct ProfileSparseDecision {
    pub(crate) source_state: ProfileFeedSourceState,
    pub(crate) cache_range: Option<(u64, u64)>,
}

pub(crate) fn profile_sparse_decision(input: ProfileSparseInput<'_>) -> ProfileSparseDecision {
    let current_since = input.now_sec.saturating_sub(INITIAL_SPAN_SECONDS);
    let current_range = Some((current_since, input.now_sec));
    if !input.current_window_empty || input.source_state != &ProfileFeedSourceState::CacheComplete {
        return ProfileSparseDecision {
            source_state: input.source_state.clone(),
            cache_range: current_range,
        };
    }
    let mut until = input.now_sec;
    let mut span = INITIAL_SPAN_SECONDS;
    for _ in 0..MAX_SPARSE_STEPS {
        let since = until.saturating_sub(span);
        let coverage = range_input(&input, since, until);
        if !profile_range_complete_empty(input.coverage_rows, coverage) {
            return incomplete_or_nonempty(input, since, until, span);
        }
        match plan_profile_sparse_scan(ProfileScanInput {
            until,
            span_seconds: span,
            floor: HISTORY_FLOOR,
            complete_empty: true,
            dense: false,
            incomplete: false,
        }) {
            ProfileScanDecision::EmptyProven => {
                return ProfileSparseDecision {
                    source_state: ProfileFeedSourceState::EmptyProven,
                    cache_range: Some((since, until)),
                };
            }
            ProfileScanDecision::ContinueOlder {
                since: _,
                until: next_until,
                span_seconds: next_span,
            } => {
                until = next_until;
                span = next_span;
            }
            ProfileScanDecision::RetryDense { .. } | ProfileScanDecision::WaitForProof => {
                return searching_older(since, until, span);
            }
        }
    }
    searching_older(
        until.saturating_sub(span),
        until,
        span,
    )
}

fn incomplete_or_nonempty(
    input: ProfileSparseInput<'_>,
    since: u64,
    until: u64,
    span: u64,
) -> ProfileSparseDecision {
    if profile_range_complete(input.coverage_rows, range_input(&input, since, until)) {
        return ProfileSparseDecision {
            source_state: ProfileFeedSourceState::CacheComplete,
            cache_range: Some((since, until)),
        };
    }
    searching_older(since, until, span)
}

fn searching_older(since: u64, until: u64, span_seconds: u64) -> ProfileSparseDecision {
    ProfileSparseDecision {
        source_state: ProfileFeedSourceState::SearchingOlder {
            since,
            until,
            span_seconds,
        },
        cache_range: Some((since, until)),
    }
}

fn range_input<'a>(
    input: &ProfileSparseInput<'a>,
    since: u64,
    until: u64,
) -> ProfileCoverageInput<'a> {
    ProfileCoverageInput {
        owner: input.owner,
        profile_pubkey: input.profile_pubkey,
        selected_relays: input.selected_relays,
        author_routes: input.author_routes,
        since,
        until,
    }
}
