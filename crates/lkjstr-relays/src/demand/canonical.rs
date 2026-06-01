#![doc = "Canonical demand relay and filter keys."]

use lkjstr_protocol::{NostrFilter, normalize_relay_url};

#[must_use]
pub fn canonical_relays(relays: &[String]) -> Vec<String> {
    let mut values = relays
        .iter()
        .filter_map(|relay| normalize_relay_url(relay))
        .collect::<Vec<_>>();
    values.sort();
    values.dedup();
    values
}

#[must_use]
pub fn canonical_filters_key(filters: &[NostrFilter]) -> String {
    let mut records = filters.iter().map(filter_key).collect::<Vec<_>>();
    records.sort();
    list_key(&records)
}

#[must_use]
pub fn canonical_relays_key(relays: &[String]) -> String {
    list_key(&canonical_relays(relays))
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
        text.dedup();
        parts.push(fields(&[name, &list_key(&text)]));
    }
}

fn push_number(parts: &mut Vec<String>, name: &str, value: Option<u64>) {
    if let Some(value) = value {
        parts.push(fields(&[name, &value.to_string()]));
    }
}

fn sorted_strings(values: &[String]) -> String {
    let mut values = values.to_vec();
    values.sort();
    values.dedup();
    list_key(&values)
}

pub(super) fn list_key(values: &[String]) -> String {
    fields(
        values
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .as_slice(),
    )
}

pub(super) fn fields(values: &[&str]) -> String {
    values
        .iter()
        .map(|value| format!("{}:{value}", value.len()))
        .collect::<Vec<_>>()
        .join("|")
}
