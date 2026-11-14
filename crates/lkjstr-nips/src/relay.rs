//! NIP-65 metadata and a deterministic, budgeted weighted set-cover heuristic.
use crate::{
    Error, Result,
    event::{Tag, UnsignedEvent},
};
use std::collections::{BTreeMap, BTreeSet};

/// Validate and normalize a WebSocket relay URL (without userinfo or fragments).
pub fn relay_url(value: &str) -> Result<String> {
    let url = url::Url::parse(value).map_err(|_| Error::Invalid)?;
    if !matches!(url.scheme(), "ws" | "wss")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err(Error::Invalid);
    }
    Ok(url.to_string())
}
/// An author's advertised relay capabilities.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RelayUsage {
    /// Canonical relay URL.
    pub url: String,
    /// Reads mentions from this relay.
    pub read: bool,
    /// Publishes authored events here.
    pub write: bool,
}
/// Parse kind 10002; malformed entries are ignored and duplicates merged.
pub fn relay_list(event: &UnsignedEvent) -> Result<Vec<RelayUsage>> {
    if event.kind != 10002 {
        return Err(Error::Invalid);
    }
    let mut entries: BTreeMap<String, (bool, bool)> = BTreeMap::new();
    for tag in &event.tags {
        if tag.first().is_none_or(|n| n != "r") {
            continue;
        }
        let Some(raw) = tag.get(1) else {
            continue;
        };
        let Ok(url) = relay_url(raw) else {
            continue;
        };
        let usage = match tag.get(2).map(String::as_str) {
            None => (true, true),
            Some("read") => (true, false),
            Some("write") => (false, true),
            _ => continue,
        };
        let flags = entries.entry(url).or_default();
        flags.0 |= usage.0;
        flags.1 |= usage.1;
    }
    Ok(entries
        .into_iter()
        .map(|(url, (read, write))| RelayUsage { url, read, write })
        .collect())
}
/// Build NIP-65 tags; reject entries that advertise no capability.
pub fn relay_tags(entries: &[RelayUsage]) -> Result<Vec<Tag>> {
    entries
        .iter()
        .map(|r| {
            let mut tag = vec!["r".into(), relay_url(&r.url)?];
            match (r.read, r.write) {
                (true, true) => {}
                (true, false) => tag.push("read".into()),
                (false, true) => tag.push("write".into()),
                _ => return Err(Error::Invalid),
            }
            Ok(tag)
        })
        .collect()
}
/// A bounded selection with explicit incomplete coverage.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cover {
    /// Relays in greedy selection order.
    pub relays: Vec<String>,
    /// Authors not covered within the relay budget.
    pub uncovered: BTreeSet<String>,
}
/// Choose up to `budget` relays covering authors' write lists.
///
/// Maximizes newly covered authors times `(0.5 + clamped_score)` each round.
/// Missing/NaN scores are neutral (0.5); ties prefer lexical URL order.
/// This is a heuristic, not an optimal solver; it reports uncovered authors.
///
/// ```
/// use std::collections::BTreeMap;
/// use lkjstr_nips::relay::outbox_cover;
/// let authors = BTreeMap::from([("alice".into(), vec!["wss://r.example".into()])]);
/// let cover = outbox_cover(&authors, &BTreeMap::new(), 2);
/// assert!(cover.uncovered.is_empty());
/// ```
pub fn outbox_cover(
    authors: &BTreeMap<String, Vec<String>>,
    scores: &BTreeMap<String, f64>,
    budget: usize,
) -> Cover {
    let mut candidates: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let normalized: BTreeMap<_, _> = scores
        .iter()
        .filter_map(|(r, s)| relay_url(r).ok().map(|r| (r, *s)))
        .collect();
    for (author, relays) in authors {
        for raw in relays {
            if let Ok(relay) = relay_url(raw) {
                candidates.entry(relay).or_default().insert(author.clone());
            }
        }
    }
    let mut cover = Cover {
        relays: vec![],
        uncovered: authors.keys().cloned().collect(),
    };
    while cover.relays.len() < budget {
        let mut best: Option<(String, f64)> = None;
        for (relay, writers) in &candidates {
            let count = writers.intersection(&cover.uncovered).count();
            if count == 0 {
                continue;
            }
            let score = normalized
                .get(relay)
                .copied()
                .filter(|s| s.is_finite())
                .unwrap_or(0.5)
                .clamp(0.0, 1.0);
            let utility = count as f64 * (0.5 + score);
            if best.as_ref().is_none_or(|(_, u)| utility > *u) {
                best = Some((relay.clone(), utility));
            }
        }
        let Some((relay, _)) = best else {
            break;
        };
        if let Some(writers) = candidates.remove(&relay) {
            cover.uncovered.retain(|author| !writers.contains(author));
        }
        cover.relays.push(relay);
    }
    cover
}
