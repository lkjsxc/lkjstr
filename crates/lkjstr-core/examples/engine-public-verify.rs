//! Offline verification and native eligibility for bounded public read-only measurements.
use lkjstr_core::{
    engine::{protocol::Source, query, wire::queries::Query},
    store::Store,
};
use lkjstr_protocol::{NostrEvent, VerificationResult, verify_event};
use serde_json::{Value, json};
use std::{
    collections::BTreeSet,
    io::{self, Read},
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin()
        .take(64 * 1024 * 1024 + 1)
        .read_to_string(&mut input)?;
    if input.len() > 64 * 1024 * 1024 {
        return Err("measurement input exceeds 64 MiB".into());
    }
    let value: Value = serde_json::from_str(&input)?;
    let controls = value
        .as_array()
        .or_else(|| value["events"].as_array())
        .ok_or("events array required")?;
    let context = value["context"].as_array().cloned().unwrap_or_default();
    if controls.len() + context.len() > 40000 {
        return Err("measurement input exceeds 40000 events".into());
    }
    let mut store = Store::new(40000);
    let mut verified = BTreeSet::new();
    let mut control_verified = BTreeSet::new();
    let mut control_rejected = BTreeSet::new();
    let mut rejected = 0;
    for (index, raw) in context.iter().chain(controls).enumerate() {
        let is_control = index >= context.len();
        match serde_json::from_value::<NostrEvent>(raw.clone()) {
            Ok(event) if matches!(verify_event(&event), VerificationResult::Ok(_)) => {
                verified.insert(event.id.clone());
                if is_control {
                    control_verified.insert(event.id.clone());
                }
                store.insert(event, None);
            }
            _ => {
                rejected += 1;
                if is_control && let Some(id) = raw["id"].as_str() {
                    control_rejected.insert(id.to_owned());
                }
            }
        }
    }
    // A valid cached body must never lend signature credit to a distinct control body.
    // Conflicting valid/invalid duplicate controls remain conservatively unverified.
    control_verified.retain(|id| !control_rejected.contains(id));
    let mut result = json!({"verified": verified, "controlVerified": control_verified,
        "rejected": rejected});
    if value["relationships"].as_bool() == Some(true) {
        let ids: BTreeSet<_> = controls
            .iter()
            .filter_map(|event| event["id"].as_str())
            .filter(|id| control_verified.contains(*id))
            .collect();
        let relations: Vec<_> = ids
            .into_iter()
            .filter_map(|id| store.get(id))
            .map(|event| json!({"id": event.id,
                "parent": lkjstr_protocol::reply_parent(&event),
                "root": lkjstr_protocol::reply_root(&event)}))
            .collect();
        result["relationships"] = json!(relations);
    }
    if let Some(queries) = value["queries"].as_object() {
        let mut policies = serde_json::Map::new();
        for (name, spec) in queries {
            let wire: Query = serde_json::from_value(spec["query"].clone())?;
            let mut q = wire.convert().ok_or("unsupported query")?;
            q.filters.since = spec["since"].as_u64().or(q.filters.since);
            q.filters.until = spec["until"].as_u64().or(q.filters.until);
            let ordered: Vec<_> = query::events(&store, &q)
                .iter()
                .map(|event| event.id.clone())
                .collect();
            let selected: BTreeSet<_> = ordered.iter().cloned().collect();
            let mut eligible = BTreeSet::new();
            let mut excluded = Vec::new();
            let ids: BTreeSet<_> = controls
                .iter()
                .filter_map(|raw| raw["id"].as_str())
                .collect();
            for id in ids {
                let event = store.get(id);
                let reason = if !control_verified.contains(id) {
                    Some("invalid-signature".into())
                } else if let Some(event) = event {
                    if q.source == Source::Notifications
                        && q.account.as_deref() == Some(&event.pubkey)
                    {
                        Some("own-notification".into())
                    } else if let Some(reason) = query::hidden(&store, &q, &event) {
                        Some(reason)
                    } else if !selected.contains(id) {
                        Some("source-or-query-filter".into())
                    } else {
                        None
                    }
                } else {
                    Some("deleted-or-evicted".into())
                };
                if let Some(reason) = reason {
                    excluded.push(json!({"id": id, "reason": reason}));
                } else {
                    eligible.insert(id);
                }
            }
            let mut policy = json!({"eligible": eligible, "excluded": excluded, "query": q});
            if value["ordered"].as_bool() == Some(true) {
                policy["ordered"] = json!(ordered);
            }
            policies.insert(name.clone(), policy);
        }
        result["eligibility"] = Value::Object(policies);
        result["storeEvents"] = json!(store.len());
        result["storeEvictions"] = json!(store.evictions());
    }
    println!("{result}");
    Ok(())
}
