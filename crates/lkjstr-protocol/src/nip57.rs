use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{KIND_ZAP_RECEIPT, NostrEvent, is_event_id, tag_values};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ZapTarget {
    pub pubkey: String,
    pub relays: Vec<String>,
    pub weight: f64,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct ZapReceiptGroup {
    pub target_event_id: String,
    pub amount_msats: u64,
    pub actors: Vec<String>,
}

pub fn zap_targets(event: &NostrEvent, profile_pubkey: Option<&str>) -> Vec<ZapTarget> {
    let tags: Vec<&Vec<String>> = event
        .tags
        .iter()
        .filter(|tag| tag.first().is_some_and(|name| name == "zap"))
        .filter(|tag| tag.get(1).is_some_and(|value| is_any_hex64(value)))
        .collect();
    if tags.is_empty() {
        return vec![ZapTarget {
            pubkey: profile_pubkey.unwrap_or(&event.pubkey).to_owned(),
            relays: Vec::new(),
            weight: 1.0,
        }];
    }
    let has_weight = tags
        .iter()
        .any(|tag| tag.get(3).and_then(|value| numeric_weight(value)).is_some());
    tags.into_iter()
        .map(|tag| ZapTarget {
            pubkey: tag.get(1).cloned().unwrap_or_default(),
            relays: tag
                .get(2)
                .filter(|relay| !relay.is_empty())
                .map(|relay| vec![relay.to_owned()])
                .unwrap_or_default(),
            weight: tag
                .get(3)
                .and_then(|value| numeric_weight(value))
                .unwrap_or(if has_weight { 0.0 } else { 1.0 }),
        })
        .filter(|target| target.weight > 0.0)
        .collect()
}

pub fn split_zap_amounts(total_msats: u64, targets: &[ZapTarget]) -> Vec<u64> {
    let weight_total: f64 = targets.iter().map(|target| target.weight).sum();
    if total_msats < 1 || weight_total <= 0.0 {
        return targets.iter().map(|_| 0).collect();
    }
    let mut assigned = 0;
    targets
        .iter()
        .enumerate()
        .map(|(index, target)| {
            if index == targets.len() - 1 {
                return total_msats.saturating_sub(assigned);
            }
            let amount = ((total_msats as f64 * target.weight) / weight_total).floor() as u64;
            assigned += amount;
            amount
        })
        .collect()
}

pub fn zap_receipt_amount_msats(event: &NostrEvent) -> Option<u64> {
    numeric_tag(event, "amount").or_else(|| {
        let description = crate::first_tag_value(event, "description")?;
        let value = serde_json::from_str::<Value>(&description).ok()?;
        numeric_tag_value(&value, "amount")
    })
}

pub fn zap_target_event_id(event: &NostrEvent) -> Option<String> {
    tag_values(event, "e")
        .into_iter()
        .last()
        .filter(|id| is_event_id(id))
}

pub fn group_zap_receipts(events: &[NostrEvent]) -> BTreeMap<String, ZapReceiptGroup> {
    let mut groups = BTreeMap::<String, (u64, Vec<String>)>::new();
    for event in events {
        if event.kind != KIND_ZAP_RECEIPT {
            continue;
        }
        let Some(target) = zap_target_event_id(event) else {
            continue;
        };
        let Some(amount) = zap_receipt_amount_msats(event) else {
            continue;
        };
        let entry = groups.entry(target).or_insert_with(|| (0, Vec::new()));
        entry.0 += amount;
        if !entry.1.contains(&event.pubkey) {
            entry.1.push(event.pubkey.to_owned());
            entry.1.sort();
        }
    }
    groups
        .into_iter()
        .map(|(target_event_id, (amount_msats, actors))| {
            (
                target_event_id.to_owned(),
                ZapReceiptGroup {
                    target_event_id,
                    amount_msats,
                    actors,
                },
            )
        })
        .collect()
}

fn numeric_weight(value: &str) -> Option<f64> {
    value
        .parse::<f64>()
        .ok()
        .filter(|number| *number > 0.0 && number.is_finite())
}

fn numeric_tag(event: &NostrEvent, name: &str) -> Option<u64> {
    event
        .tags
        .iter()
        .find(|tag| tag.first().is_some_and(|item| item == name))
        .and_then(|tag| tag.get(1))
        .and_then(|value| numeric_string(value))
}

fn numeric_tag_value(value: &Value, name: &str) -> Option<u64> {
    value
        .get("tags")?
        .as_array()?
        .iter()
        .filter_map(Value::as_array)
        .find(|tag| tag.first().and_then(|item| item.as_str()) == Some(name))
        .and_then(|tag| tag.get(1))
        .and_then(Value::as_str)
        .and_then(numeric_string)
}

fn numeric_string(value: &str) -> Option<u64> {
    if value.chars().all(|item| item.is_ascii_digit()) {
        value.parse::<u64>().ok()
    } else {
        None
    }
}

fn is_any_hex64(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}
