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
    let mut rejected = 0;
    for raw in context.iter().chain(controls) {
        let Ok(event) = serde_json::from_value::<NostrEvent>(raw.clone()) else {
            rejected += 1;
            continue;
        };
        if matches!(verify_event(&event), VerificationResult::Ok(_)) {
            verified.insert(event.id.clone());
            store.insert(event, None);
        } else {
            rejected += 1;
        }
    }
    let mut result = json!({"verified": verified, "rejected": rejected});
    if let Some(queries) = value["queries"].as_object() {
        let mut policies = serde_json::Map::new();
        for (name, spec) in queries {
            let wire: Query = serde_json::from_value(spec["query"].clone())?;
            let mut q = wire.convert().ok_or("unsupported query")?;
            q.filters.since = spec["since"].as_u64().or(q.filters.since);
            q.filters.until = spec["until"].as_u64().or(q.filters.until);
            let selected: BTreeSet<_> = query::events(&store, &q)
                .iter()
                .map(|event| event.id.clone())
                .collect();
            let mut eligible = BTreeSet::new();
            let mut excluded = Vec::new();
            let ids: BTreeSet<_> = controls
                .iter()
                .filter_map(|raw| raw["id"].as_str())
                .collect();
            for id in ids {
                let event = store.get(id);
                let reason = if !verified.contains(id) {
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
            policies.insert(
                name.clone(),
                json!({"eligible": eligible, "excluded": excluded, "query": q}),
            );
        }
        result["eligibility"] = Value::Object(policies);
        result["storeEvents"] = json!(store.len());
        result["storeEvictions"] = json!(store.evictions());
    }
    println!("{result}");
    Ok(())
}
