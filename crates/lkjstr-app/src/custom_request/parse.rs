#![doc = "Custom Request parser and app policy clamps."]

use std::collections::BTreeSet;

use lkjstr_protocol::{NostrFilter, normalize_relay_url, parse_filter_value};
use serde_json::Value;

use super::{
    CustomRequest, CustomRequestError, CustomRequestErrorKind as Kind, CustomRequestLimitClamp,
};

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
        let (filters, limit_clamps) = parse_filters(items)?;
        return Ok(CustomRequest {
            filters,
            relays: Vec::new(),
            sub_id: None,
            limit_clamps,
            relay_limit_clamps: Vec::new(),
            relay_filters: Vec::new(),
        });
    }
    if let Value::Object(map) = value
        && (map.contains_key("filters") || map.contains_key("filter"))
    {
        let Some(raw) = map.get("filters").or_else(|| map.get("filter")) else {
            return Err(CustomRequestError::new(Kind::InvalidShape));
        };
        let (filters, limit_clamps) = parse_filter_field(raw)?;
        return Ok(CustomRequest {
            filters,
            relays: parse_relays(map.get("relays"))?,
            sub_id: None,
            limit_clamps,
            relay_limit_clamps: Vec::new(),
            relay_filters: Vec::new(),
        });
    }
    let (filter, clamp) = parse_one_filter(value, 0)?;
    Ok(CustomRequest {
        filters: vec![filter],
        relays: Vec::new(),
        sub_id: None,
        limit_clamps: clamp.into_iter().collect(),
        relay_limit_clamps: Vec::new(),
        relay_filters: Vec::new(),
    })
}

fn parse_req(items: &[Value]) -> Result<CustomRequest, CustomRequestError> {
    let sub_id = items
        .get(1)
        .and_then(Value::as_str)
        .ok_or_else(|| CustomRequestError::new(Kind::InvalidReqSubId))?;
    let (filters, limit_clamps) = parse_filters(items.get(2..).unwrap_or_default())?;
    Ok(CustomRequest {
        sub_id: Some(sub_id.to_owned()),
        filters,
        relays: Vec::new(),
        limit_clamps,
        relay_limit_clamps: Vec::new(),
        relay_filters: Vec::new(),
    })
}

fn parse_filter_field(
    value: &Value,
) -> Result<(Vec<NostrFilter>, Vec<CustomRequestLimitClamp>), CustomRequestError> {
    match value {
        Value::Array(items) => parse_filters(items),
        item => {
            let (filter, clamp) = parse_one_filter(item, 0)?;
            Ok((vec![filter], clamp.into_iter().collect()))
        }
    }
}

fn parse_filters(
    values: &[Value],
) -> Result<(Vec<NostrFilter>, Vec<CustomRequestLimitClamp>), CustomRequestError> {
    if values.len() > MAX_FILTERS {
        return Err(CustomRequestError::new(Kind::TooManyFilters));
    }
    let mut filters = Vec::new();
    let mut limit_clamps = Vec::new();
    for (index, value) in values.iter().enumerate() {
        let (filter, clamp) = parse_one_filter(value, index)?;
        filters.push(filter);
        if let Some(clamp) = clamp {
            limit_clamps.push(clamp);
        }
    }
    Ok((filters, limit_clamps))
}

fn parse_one_filter(
    value: &Value,
    index: usize,
) -> Result<(NostrFilter, Option<CustomRequestLimitClamp>), CustomRequestError> {
    let filter =
        parse_filter_value(value).ok_or_else(|| CustomRequestError::new(Kind::InvalidFilter))?;
    clamp_filter(filter, index)
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

fn clamp_filter(
    mut filter: NostrFilter,
    index: usize,
) -> Result<(NostrFilter, Option<CustomRequestLimitClamp>), CustomRequestError> {
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
    let clamp = filter
        .limit
        .filter(|limit| *limit > MAX_LIMIT)
        .map(|original_limit| CustomRequestLimitClamp {
            filter_index: index,
            original_limit,
            effective_limit: MAX_LIMIT,
        });
    if clamp.is_some() {
        filter.limit = Some(MAX_LIMIT);
    }
    Ok((filter, clamp))
}

fn check_values(values: Option<&Vec<String>>, kind: Kind) -> Result<(), CustomRequestError> {
    if values.is_some_and(|items| items.len() > MAX_VALUES) {
        Err(CustomRequestError::new(kind))
    } else {
        Ok(())
    }
}
