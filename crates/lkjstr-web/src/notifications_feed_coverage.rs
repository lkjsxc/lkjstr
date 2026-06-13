use lkjstr_app::{
    NotificationsFeedSourceState, NotificationsLiveQueryInput, notifications_feed_id,
    notifications_live_query_input, plan_query_demand,
};
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::{FeedCoverageRecord, StorageOutcome};

use crate::home_feed_coverage::semantic_filter_key;
use crate::{
    host_status::problem_status, sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_feed_coverage_for_feed,
};

pub(crate) const PARTIAL_REASON: &str =
    "Cached notification records loaded without complete coverage proof.";

pub(crate) struct NotificationsCoverageInput<'a> {
    pub(crate) owner: &'a str,
    pub(crate) active_pubkey: &'a str,
    pub(crate) selected_relays: &'a [String],
    pub(crate) since: u64,
    pub(crate) until: u64,
    pub(crate) page_size: u64,
}

pub(crate) async fn load_notifications_source_state(
    db_name: &str,
    worker_url: &str,
    input: NotificationsCoverageInput<'_>,
) -> NotificationsFeedSourceState {
    let feed_key = notifications_feed_id(input.owner);
    let coverage = with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_feed_coverage_for_feed(&store, &feed_key).await
    })
    .await;
    match coverage {
        StorageOutcome::Ok(rows) => notifications_coverage_source_state(&rows, input),
        outcome => NotificationsFeedSourceState::CachedPartial {
            reason: problem_status("Feed coverage unavailable", outcome),
            retry_available: true,
        },
    }
}

pub(crate) fn notifications_coverage_source_state(
    rows: &[FeedCoverageRecord],
    input: NotificationsCoverageInput<'_>,
) -> NotificationsFeedSourceState {
    let requirements = coverage_requirements(input);
    if !requirements.is_empty()
        && requirements
            .iter()
            .all(|requirement| coverage_covers(rows, requirement))
    {
        return NotificationsFeedSourceState::CacheComplete;
    }
    NotificationsFeedSourceState::CachedPartial {
        reason: PARTIAL_REASON.to_owned(),
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

fn coverage_requirements(input: NotificationsCoverageInput<'_>) -> Vec<CoverageRequirement> {
    let feed_key = notifications_feed_id(input.owner);
    let since = input.since;
    let until = input.until;
    let query = notifications_live_query_input(NotificationsLiveQueryInput {
        owner: input.owner.to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.to_vec(),
        account_pubkey: input.active_pubkey.to_owned(),
        author_routes: Vec::new(),
        disabled_relays: Vec::new(),
        since: Some(since),
        now_sec: until,
        page_size: input.page_size,
    });
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
                            since,
                            until,
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
