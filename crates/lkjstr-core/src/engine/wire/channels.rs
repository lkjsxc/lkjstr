use super::{Query, note};
use crate::engine::{Engine, channels, rows};
use lkjstr_protocol::{EventPointer, encode_nevent};
use serde_json::{Value, json};
pub(super) fn row(e: &Engine, id: &str, account: Option<&str>, hints: &[String]) -> Option<Value> {
    if e.store.get(id).is_none() && e.network.lookup_complete(id) {
        return None;
    }
    if e.store.get(id).is_some_and(|event| event.kind != 40) {
        return None;
    }
    let (data, creation) = channels::metadata(&e.store, id);
    let joined = channels::joined(&e.store, account).iter().any(|v| v == id);
    let mut relays = channels::relays(&e.store, id);
    relays.extend(hints.iter().cloned());
    relays.sort();
    relays.dedup();
    relays.truncate(8);
    let mut v = json!({"kind":"channel","key":format!("channel:{id}"),"id":id,
        "bech32":encode_nevent(&EventPointer{id:id.into(),kind:Some(40),author:creation.as_ref().map(|c|c.pubkey.clone()),relays:Some(relays)}).ok()?,
        "name":data["name"].as_str().unwrap_or(""),"about":data["about"].as_str().unwrap_or(""),
        "joined":joined,"own":creation.as_ref().is_some_and(|c|Some(c.pubkey.as_str())==account),"unread":0});
    if let Some(p) = data["picture"].as_str().filter(|s| !s.is_empty()) {
        v["picture"] = json!(p);
    }
    if let Some(c) = creation {
        v["creator"] = note::author(&rows::author(&e.store, &c.pubkey));
    }
    let messages = channels::messages(&e.store, id);
    if let Some(last) = messages.first() {
        v["last"] = json!({"at":last.created_at.saturating_mul(1000),"author":note::author(&rows::author(&e.store,&last.pubkey)),"excerpt":last.content.lines().next().unwrap_or("").chars().take(160).collect::<String>()});
    }
    if joined {
        let mark = account
            .and_then(|a| e.seen.get(&format!("channel:{a}:{id}")))
            .copied()
            .unwrap_or(0);
        v["unread"] = json!(
            messages
                .iter()
                .filter(|m| Some(m.pubkey.as_str()) != account
                    && m.created_at.saturating_mul(1000) > mark)
                .take(99)
                .count()
        );
    }
    Some(v)
}
pub(super) fn list(e: &Engine, q: &Query) -> Vec<Value> {
    let Some(converted) = q.convert() else {
        return vec![];
    };
    let joined = channels::joined(&e.store, q.account.as_deref());
    let mut ids = if let Some(id) = converted.target {
        vec![id]
    } else {
        joined
            .iter()
            .cloned()
            .chain(
                e.store
                    .feed(&crate::store::Query {
                        kinds: vec![40],
                        limit: 6000,
                        ..Default::default()
                    })
                    .iter()
                    .map(|e| e.id.clone()),
            )
            .collect()
    };
    let mut seen = std::collections::HashSet::new();
    ids.retain(|id| seen.insert(id.clone()));
    let mut out = ids
        .iter()
        .filter_map(|id| row(e, id, q.account.as_deref(), &converted.filters.relay_hints))
        .filter(|row| {
            let text = format!(
                "{} {}",
                row["name"].as_str().unwrap_or(""),
                row["about"].as_str().unwrap_or("")
            )
            .to_lowercase();
            converted.filters.text.as_ref().is_none_or(|t| {
                t.split_whitespace()
                    .all(|w| text.contains(&w.to_lowercase()))
            })
        })
        .collect::<Vec<_>>();
    out.sort_by(|a, b| {
        let position = |r: &Value| {
            joined
                .iter()
                .position(|id| Some(id.as_str()) == r["id"].as_str())
        };
        match (position(a), position(b)) {
            (Some(a), Some(b)) => a.cmp(&b),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            _ => b["last"]["at"]
                .as_u64()
                .cmp(&a["last"]["at"].as_u64())
                .then_with(|| a["id"].as_str().cmp(&b["id"].as_str())),
        }
    });
    out
}
