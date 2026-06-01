#![doc = "Semantic page-read key derivation."]

use lkjstr_protocol::NostrFilter;

use crate::{default_read_page_max_events, relay_subscription_hash, request_timeout_ms};

use super::{
    FeedCursorPoint, PageReadBounds, PageReadDirection, PageReadIntent, ReadDedupeOptions,
    RelayReadRequest, RelayRouteGroup,
};

#[must_use]
pub fn page_read_bounds(intent: &PageReadIntent) -> PageReadBounds {
    if intent.before.is_some() || intent.after.is_some() {
        return PageReadBounds {
            before: intent.before.clone(),
            after: intent.after.clone(),
        };
    }
    match intent.direction {
        PageReadDirection::Older => PageReadBounds {
            before: intent.cursor.clone(),
            after: None,
        },
        PageReadDirection::Newer => PageReadBounds {
            before: None,
            after: intent.cursor.clone(),
        },
        PageReadDirection::Initial => PageReadBounds {
            before: None,
            after: None,
        },
    }
}

#[must_use]
pub fn page_read_semantic_key(intent: &PageReadIntent) -> String {
    let bounds = page_read_bounds(intent);
    let route_fingerprint = match &intent.route_fingerprint {
        Some(value) => value.as_str(),
        None => "",
    };
    let raw = fields(&[
        intent.surface.as_key(),
        intent.phase.as_key(),
        intent.direction.as_key(),
        &sorted_strings(&intent.authors),
        &intent.page_size.to_string(),
        &cursor_key(bounds.before.as_ref()),
        &cursor_key(bounds.after.as_ref()),
        &sorted_strings(&intent.selected_relays),
        route_fingerprint,
        intent.purpose.as_key(),
        &filters_key(&intent.relay_filters),
    ]);
    format!("page:{}", relay_subscription_hash(&raw, 12))
}

#[must_use]
pub fn route_group_fingerprint(groups: &[RelayRouteGroup]) -> String {
    let mut records = groups.iter().map(route_group_key).collect::<Vec<_>>();
    records.sort();
    list_key(&records)
}

#[must_use]
pub fn subscription_key(request: &RelayReadRequest) -> String {
    fields(&[
        &request.key,
        &sorted_strings(&request.relays),
        &filters_key(&request.filters),
        request.purpose.as_key(),
    ])
}

#[must_use]
pub fn read_dedupe_key(request: &RelayReadRequest, options: ReadDedupeOptions) -> String {
    fields(&[
        &subscription_key(request),
        &options
            .timeout_ms
            .map_or(request_timeout_ms(), |timeout| timeout)
            .to_string(),
        &options
            .max_events
            .map_or(default_read_page_max_events(), |max| max)
            .to_string(),
    ])
}

fn route_group_key(group: &RelayRouteGroup) -> String {
    fields(&[
        &group.key,
        &sorted_strings(&group.relays),
        &sorted_strings(&group.authors),
        &group.source,
    ])
}

fn filters_key(filters: &[NostrFilter]) -> String {
    let records = filters.iter().map(filter_key).collect::<Vec<_>>();
    list_key(&records)
}

fn filter_key(filter: &NostrFilter) -> String {
    let mut parts = Vec::new();
    push_strings(&mut parts, "ids", filter.ids.as_ref());
    push_strings(&mut parts, "authors", filter.authors.as_ref());
    push_numbers(&mut parts, "kinds", filter.kinds.as_ref());
    push_number(&mut parts, "since", filter.since);
    push_number(&mut parts, "until", filter.until);
    push_number(&mut parts, "limit", filter.limit);
    if let Some(search) = &filter.search {
        parts.push(fields(&["search", search]));
    }
    for (tag, values) in &filter.tags {
        parts.push(fields(&["tag", tag, &sorted_strings(values)]));
    }
    list_key(&parts)
}

fn push_strings(parts: &mut Vec<String>, name: &str, values: Option<&Vec<String>>) {
    if let Some(values) = values {
        parts.push(fields(&[name, &sorted_strings(values)]));
    }
}

fn push_numbers(parts: &mut Vec<String>, name: &str, values: Option<&Vec<u64>>) {
    if let Some(values) = values {
        let mut text = values.iter().map(u64::to_string).collect::<Vec<_>>();
        text.sort();
        parts.push(fields(&[name, &list_key(&text)]));
    }
}

fn push_number(parts: &mut Vec<String>, name: &str, value: Option<u64>) {
    if let Some(value) = value {
        parts.push(fields(&[name, &value.to_string()]));
    }
}

fn cursor_key(cursor: Option<&FeedCursorPoint>) -> String {
    cursor.map_or_else(String::new, |cursor| {
        fields(&[&cursor.created_at.to_string(), &cursor.id])
    })
}

fn sorted_strings(values: &[String]) -> String {
    let mut values = values.to_vec();
    values.sort();
    list_key(&values)
}

fn list_key(values: &[String]) -> String {
    fields(
        values
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .as_slice(),
    )
}

fn fields(values: &[&str]) -> String {
    values
        .iter()
        .map(|value| format!("{}:{value}", value.len()))
        .collect::<Vec<_>>()
        .join("|")
}
