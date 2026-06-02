#![doc = "Custom Request parser and app policy clamps."]

use std::collections::BTreeSet;

use lkjstr_protocol::{NostrFilter, normalize_relay_url, parse_filter_value};
use serde_json::Value;

use super::{CustomRequest, CustomRequestError, CustomRequestErrorKind as Kind};

const MAX_JSON_BYTES: usize = 64 * 1024;
const MAX_FILTERS: usize = 8;
const MAX_RELAYS: usize = 32;
const MAX_VALUES: usize = 500;
const MAX_SEARCH_BYTES: usize = 256;
const MAX_LIMIT: u64 = 500;

pub fn parse_custom_request(input: &str) -> Result<CustomRequest, CustomRequestError> {
    if input.len() > MAX_JSON_BYTES {
        return Err(CustomRequestError::new(Kind::JsonTooLarge));
    }
    let value = serde_json::from_str::<Value>(input)
        .map_err(|error| CustomRequestError::with_detail(Kind::InvalidJson, error.to_string()))?;
    let request = parse_value(&value)?;
    if request.filters.is_empty() {
        return Err(CustomRequestError::new(Kind::NoValidFilters));
    }
    Ok(request)
}

fn parse_value(value: &Value) -> Result<CustomRequest, CustomRequestError> {
    if let Value::Array(items) = value
        && items.first().and_then(Value::as_str) == Some("REQ")
    {
        return parse_req(items);
    }
    if let Value::Array(items) = value {
        return Ok(CustomRequest {
            filters: parse_filters(items)?,
            relays: Vec::new(),
            sub_id: None,
        });
    }
    if let Value::Object(map) = value
        && (map.contains_key("filters") || map.contains_key("filter"))
    {
        let Some(raw) = map.get("filters").or_else(|| map.get("filter")) else {
            return Err(CustomRequestError::new(Kind::InvalidShape));
        };
        return Ok(CustomRequest {
            filters: parse_filter_field(raw)?,
            relays: parse_relays(map.get("relays"))?,
            sub_id: None,
        });
    }
    Ok(CustomRequest {
        filters: vec![parse_one_filter(value)?],
        relays: Vec::new(),
        sub_id: None,
    })
}

fn parse_req(items: &[Value]) -> Result<CustomRequest, CustomRequestError> {
    let sub_id = items
        .get(1)
        .and_then(Value::as_str)
        .ok_or_else(|| CustomRequestError::new(Kind::InvalidReqSubId))?;
    Ok(CustomRequest {
        sub_id: Some(sub_id.to_owned()),
        filters: parse_filters(items.get(2..).unwrap_or_default())?,
        relays: Vec::new(),
    })
}

fn parse_filter_field(value: &Value) -> Result<Vec<NostrFilter>, CustomRequestError> {
    match value {
        Value::Array(items) => parse_filters(items),
        item => Ok(vec![parse_one_filter(item)?]),
    }
}

fn parse_filters(values: &[Value]) -> Result<Vec<NostrFilter>, CustomRequestError> {
    if values.len() > MAX_FILTERS {
        return Err(CustomRequestError::new(Kind::TooManyFilters));
    }
    values.iter().map(parse_one_filter).collect()
}

fn parse_one_filter(value: &Value) -> Result<NostrFilter, CustomRequestError> {
    let filter =
        parse_filter_value(value).ok_or_else(|| CustomRequestError::new(Kind::InvalidFilter))?;
    clamp_filter(filter)
}

fn parse_relays(value: Option<&Value>) -> Result<Vec<String>, CustomRequestError> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    let Value::Array(items) = value else {
        return Err(CustomRequestError::new(Kind::InvalidRelays));
    };
    if items.len() > MAX_RELAYS {
        return Err(CustomRequestError::new(Kind::TooManyRelays));
    }
    let mut relays = BTreeSet::new();
    for item in items {
        let relay = item
            .as_str()
            .and_then(normalize_relay_url)
            .ok_or_else(|| CustomRequestError::new(Kind::InvalidRelayUrl))?;
        relays.insert(relay);
    }
    Ok(relays.into_iter().collect())
}

fn clamp_filter(mut filter: NostrFilter) -> Result<NostrFilter, CustomRequestError> {
    check_values(filter.ids.as_ref(), Kind::TooManyIds)?;
    check_values(filter.authors.as_ref(), Kind::TooManyAuthors)?;
    if filter
        .search
        .as_ref()
        .is_some_and(|search| search.len() > MAX_SEARCH_BYTES)
    {
        return Err(CustomRequestError::new(Kind::SearchTooLarge));
    }
    for values in filter.tags.values() {
        check_values(Some(values), Kind::TooManyTagValues)?;
    }
    if filter.limit.is_some_and(|limit| limit > MAX_LIMIT) {
        filter.limit = Some(MAX_LIMIT);
    }
    Ok(filter)
}

fn check_values(values: Option<&Vec<String>>, kind: Kind) -> Result<(), CustomRequestError> {
    if values.is_some_and(|items| items.len() > MAX_VALUES) {
        Err(CustomRequestError::new(kind))
    } else {
        Ok(())
    }
}
