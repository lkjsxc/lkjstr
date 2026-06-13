use std::collections::BTreeMap;

use lkjstr_app::{
    FeedLiveQueryInput, HomeFeedSourceState, home_authors, home_live_query_input, plan_query_demand,
};
use lkjstr_protocol::NostrFilter;
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::FeedCoverageRecord;

pub(crate) struct HomeCoverageInput<'a> {
    pub(crate) owner: &'a str,
    pub(crate) active_pubkey: &'a str,
    pub(crate) follow_pubkeys: &'a [String],
    pub(crate) selected_relays: &'a [String],
    pub(crate) since: u64,
    pub(crate) until: u64,
}

pub(crate) fn home_coverage_source_state(
    rows: &[FeedCoverageRecord],
    input: HomeCoverageInput<'_>,
) -> HomeFeedSourceState {
    let requirements = coverage_requirements(input);
    if !requirements.is_empty()
        && requirements
            .iter()
            .all(|requirement| coverage_covers(rows, requirement))
    {
        return HomeFeedSourceState::CacheComplete;
    }
    HomeFeedSourceState::Partial {
        reason: "Cached rows loaded without complete coverage proof.".to_owned(),
        retry_available: true,
    }
}

pub(crate) fn semantic_filter_key(filter: &NostrFilter) -> String {
    let mut parts = Vec::new();
    push_strings(&mut parts, "ids", filter.ids.as_ref());
    push_strings(&mut parts, "authors", filter.authors.as_ref());
    push_numbers(&mut parts, "kinds", filter.kinds.as_ref());
    push_tags(&mut parts, &filter.tags);
    if let Some(search) = &filter.search {
        parts.push(format!(
            "\"search\":{}",
            serde_json::to_string(search).unwrap_or_default()
        ));
    }
    format!("{{{}}}", parts.join(","))
}

struct CoverageRequirement {
    feed_key: String,
    route_group_key: String,
    relay_url: String,
    filter_key: String,
    since: u64,
    until: u64,
}

fn coverage_requirements(input: HomeCoverageInput<'_>) -> Vec<CoverageRequirement> {
    let authors = home_authors(input.active_pubkey, input.follow_pubkeys);
    let feed_key = lkjstr_app::home_feed_id(input.owner);
    let since = input.since;
    let until = input.until;
    let query = home_live_query_input(FeedLiveQueryInput {
        owner: input.owner.to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.to_vec(),
        authors,
        author_routes: Vec::new(),
        disabled_relays: Vec::new(),
        since: Some(since),
        now_sec: until,
        page_size: 30,
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

fn push_strings(parts: &mut Vec<String>, name: &str, values: Option<&Vec<String>>) {
    if let Some(values) = values {
        let mut sorted = values.clone();
        sorted.sort();
        parts.push(format!("\"{name}\":{}", json(&sorted)));
    }
}

fn push_numbers(parts: &mut Vec<String>, name: &str, values: Option<&Vec<u64>>) {
    if let Some(values) = values {
        let mut sorted = values.clone();
        sorted.sort_unstable();
        parts.push(format!("\"{name}\":{}", json(&sorted)));
    }
}

fn push_tags(parts: &mut Vec<String>, tags: &BTreeMap<String, Vec<String>>) {
    if tags.is_empty() {
        parts.push("\"tags\":[]".to_owned());
        return;
    }
    let mut sorted = BTreeMap::new();
    for (key, values) in tags {
        let mut values = values.clone();
        values.sort();
        sorted.insert(key.clone(), values);
    }
    parts.push(format!("\"tags\":{}", json(&sorted)));
}

fn json<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_default()
}
