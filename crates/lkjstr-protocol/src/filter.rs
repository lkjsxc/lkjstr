use std::collections::BTreeMap;

use serde_json::{Map, Value};

use crate::{NostrEvent, is_event_id, is_pubkey};

#[derive(Debug, Clone, Default, Eq, PartialEq)]
pub struct NostrFilter {
    pub ids: Option<Vec<String>>,
    pub authors: Option<Vec<String>>,
    pub kinds: Option<Vec<u64>>,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub limit: Option<u64>,
    pub search: Option<String>,
    pub tags: BTreeMap<String, Vec<String>>,
}

pub fn parse_filter_value(value: &Value) -> Option<NostrFilter> {
    let Value::Object(map) = value else {
        return None;
    };
    let mut filter = NostrFilter::default();
    for (key, item) in map {
        match key.as_str() {
            "ids" => filter.ids = Some(string_array(item, Some(is_event_id))?),
            "authors" => filter.authors = Some(string_array(item, Some(is_pubkey))?),
            "kinds" => filter.kinds = Some(number_array(item)?),
            "since" => filter.since = item.as_u64(),
            "until" => filter.until = item.as_u64(),
            "limit" => filter.limit = item.as_u64(),
            "search" => filter.search = item.as_str().map(ToOwned::to_owned),
            tag if is_tag_key(tag) => {
                let values = string_array(item, None)?;
                filter.tags.insert(tag[1..].to_owned(), values);
            }
            _ => return None,
        }
        if numeric_field_failed(key, &filter) || search_failed(key, &filter) {
            return None;
        }
    }
    Some(filter)
}

pub fn matches_filter(event: &NostrEvent, filter: &NostrFilter) -> bool {
    if let Some(ids) = &filter.ids
        && !has_prefix(ids, &event.id)
    {
        return false;
    }
    if let Some(authors) = &filter.authors
        && !has_prefix(authors, &event.pubkey)
    {
        return false;
    }
    if let Some(kinds) = &filter.kinds
        && !kinds.contains(&event.kind)
    {
        return false;
    }
    if filter.since.is_some_and(|since| event.created_at < since) {
        return false;
    }
    if filter.until.is_some_and(|until| event.created_at > until) {
        return false;
    }
    filter
        .tags
        .iter()
        .all(|(key, values)| event.tags.iter().any(|tag| tag_matches(tag, key, values)))
}

pub fn matches_any_filter(event: &NostrEvent, filters: &[NostrFilter]) -> bool {
    filters.iter().any(|filter| matches_filter(event, filter))
}

pub(crate) fn filter_to_value(filter: &NostrFilter) -> Value {
    let mut map = Map::new();
    insert_array(&mut map, "ids", &filter.ids);
    insert_array(&mut map, "authors", &filter.authors);
    insert_numbers(&mut map, "kinds", &filter.kinds);
    insert_number(&mut map, "since", filter.since);
    insert_number(&mut map, "until", filter.until);
    insert_number(&mut map, "limit", filter.limit);
    if let Some(search) = &filter.search {
        map.insert("search".to_owned(), Value::String(search.clone()));
    }
    for (key, values) in &filter.tags {
        insert_array(&mut map, &format!("#{key}"), &Some(values.clone()));
    }
    Value::Object(map)
}

fn string_array(value: &Value, guard: Option<fn(&str) -> bool>) -> Option<Vec<String>> {
    let Value::Array(items) = value else {
        return None;
    };
    items
        .iter()
        .map(|item| {
            let text = item.as_str()?;
            if guard.is_some_and(|check| !check(text)) {
                return None;
            }
            Some(text.to_owned())
        })
        .collect()
}

fn number_array(value: &Value) -> Option<Vec<u64>> {
    let Value::Array(items) = value else {
        return None;
    };
    items.iter().map(Value::as_u64).collect()
}

fn is_tag_key(key: &str) -> bool {
    key.strip_prefix('#')
        .is_some_and(|suffix| suffix.chars().count() == 1)
}

fn numeric_field_failed(key: &str, filter: &NostrFilter) -> bool {
    matches!(key, "since" if filter.since.is_none())
        || matches!(key, "until" if filter.until.is_none())
        || matches!(key, "limit" if filter.limit.is_none())
}

fn search_failed(key: &str, filter: &NostrFilter) -> bool {
    key == "search" && filter.search.is_none()
}

fn has_prefix(prefixes: &[String], value: &str) -> bool {
    prefixes.iter().any(|prefix| value.starts_with(prefix))
}

fn tag_matches(tag: &[String], key: &str, values: &[String]) -> bool {
    tag.first().is_some_and(|name| name == key)
        && tag.get(1).is_some_and(|value| values.contains(value))
}

fn insert_array(map: &mut Map<String, Value>, key: &str, values: &Option<Vec<String>>) {
    if let Some(values) = values {
        map.insert(
            key.to_owned(),
            Value::Array(
                values
                    .iter()
                    .map(|value| Value::String(value.clone()))
                    .collect(),
            ),
        );
    }
}

fn insert_numbers(map: &mut Map<String, Value>, key: &str, values: &Option<Vec<u64>>) {
    if let Some(values) = values {
        map.insert(
            key.to_owned(),
            Value::Array(values.iter().copied().map(Value::from).collect()),
        );
    }
}

fn insert_number(map: &mut Map<String, Value>, key: &str, value: Option<u64>) {
    if let Some(value) = value {
        map.insert(key.to_owned(), Value::from(value));
    }
}
