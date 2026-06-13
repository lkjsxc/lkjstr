use lkjstr_app::{
    FeedLiveQueryInput, UserTimelineFeedSourceState, plan_query_demand,
    user_timeline_feed_id, user_timeline_live_query_input,
};
use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};
use lkjstr_storage::{FeedCoverageRecord, StorageOutcome};

use crate::{
    home_feed_coverage::semantic_filter_key,
    host_status::problem_status,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_feed_coverage_for_feed,
    user_timeline_host::UserTimelineHost,
    user_timeline_host_view::PARTIAL_CACHE_REASON,
};

pub(crate) struct UserTimelineCoverageInput<'a> {
    pub(crate) owner: &'a str,
    pub(crate) authors: &'a [String],
    pub(crate) selected_relays: &'a [String],
    pub(crate) author_routes: &'a [AuthorRelayRoute],
    pub(crate) since: u64,
    pub(crate) until: u64,
    pub(crate) page_size: u64,
}

pub(crate) async fn load_user_timeline_source_state(
    host: &UserTimelineHost,
    input: UserTimelineCoverageInput<'_>,
) -> UserTimelineFeedSourceState {
    let feed_key = user_timeline_feed_id(input.owner);
    let coverage = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_feed_coverage_for_feed(&store, &feed_key).await
    })
    .await;
    match coverage {
        StorageOutcome::Ok(rows) => user_timeline_coverage_source_state(&rows, input),
        outcome => UserTimelineFeedSourceState::Partial {
            reason: problem_status("User Timeline coverage unavailable", outcome),
            retry_available: true,
        },
    }
}

pub(crate) fn user_timeline_coverage_source_state(
    rows: &[FeedCoverageRecord],
    input: UserTimelineCoverageInput<'_>,
) -> UserTimelineFeedSourceState {
    let requirements = coverage_requirements(input);
    if !requirements.is_empty()
        && requirements.iter().all(|item| coverage_covers(rows, item))
    {
        return UserTimelineFeedSourceState::CacheComplete;
    }
    UserTimelineFeedSourceState::Partial {
        reason: PARTIAL_CACHE_REASON.to_owned(),
        retry_available: true,
    }
}

struct CoverageRequirement {
    feed_key: String,
    route_group_key: String,
    relay_url: String,
    filter_key: String,
    since: u64,
    until: u64,
}

fn coverage_requirements(input: UserTimelineCoverageInput<'_>) -> Vec<CoverageRequirement> {
    let query = user_timeline_live_query_input(FeedLiveQueryInput {
        owner: input.owner.to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.to_vec(),
        authors: input.authors.to_vec(),
        author_routes: input.author_routes.to_vec(),
        disabled_relays: Vec::new(),
        since: Some(input.since),
        now_sec: input.until,
        page_size: input.page_size,
    });
    let feed_key = user_timeline_feed_id(input.owner);
    let plan = plan_query_demand(query);
    let filters = plan
        .wire_request
        .filters
        .iter()
        .map(semantic_filter_key)
        .collect::<Vec<_>>();
    plan.route_plan
        .groups
        .into_iter()
        .flat_map(|group| {
            group.relays.into_iter().flat_map({
                let group_key = group.key;
                let feed_key = feed_key.clone();
                let filters = filters.clone();
                move |relay_url| {
                    filters.clone().into_iter().map({
                        let feed_key = feed_key.clone();
                        let group_key = group_key.clone();
                        move |filter_key| CoverageRequirement {
                            feed_key: feed_key.clone(),
                            route_group_key: group_key.clone(),
                            relay_url: relay_url.clone(),
                            filter_key,
                            since: input.since,
                            until: input.until,
                        }
                    })
                }
            })
        })
        .collect()
}

fn coverage_covers(rows: &[FeedCoverageRecord], requirement: &CoverageRequirement) -> bool {
    let mut intervals = rows
        .iter()
        .filter(|row| complete_match(row, requirement))
        .filter_map(|row| Some((row.since_exclusive?, row.until_exclusive?)))
        .collect::<Vec<_>>();
    intervals.sort_unstable();
    let mut covered_until = requirement.since;
    for (since, until) in intervals {
        if since > covered_until {
            return false;
        }
        covered_until = covered_until.max(until);
        if covered_until >= requirement.until {
            return true;
        }
    }
    false
}

fn complete_match(row: &FeedCoverageRecord, requirement: &CoverageRequirement) -> bool {
    row.status == "complete"
        && !row.dense
        && row.feed_key == requirement.feed_key
        && row.route_group_key == requirement.route_group_key
        && row.relay_url == requirement.relay_url
        && row.filter_fingerprint == requirement.filter_key
}
