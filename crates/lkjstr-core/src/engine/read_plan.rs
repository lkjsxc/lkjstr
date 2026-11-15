//! Pure request routing within the reader's configured transports.
//! Inputs are observations and verified outbox lists, never timeline order.
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug)]
pub struct Candidate {
    pub url: String,
    /// Quantized 0..1000 transport quality; zero is cooling down.
    pub weight: u64,
    /// Requested authors whose verified list advertises this relay for writing.
    pub authors: BTreeSet<String>,
}

/// Greedy coverage with a quality prior. Two copies are useful; first coverage
/// counts twice. Unknown authors stay on ordinary reader-selected routes.
/// This bounded selector does not claim global two-cover or discover transports.
pub fn select(candidates: &[Candidate], limit: usize) -> Vec<String> {
    let mut selected = Vec::new();
    let mut covered = BTreeMap::<&str, usize>::new();
    while selected.len() < limit.min(candidates.len()) {
        let best = candidates
            .iter()
            .filter(|r| !selected.contains(&r.url))
            .max_by(|a, b| {
                let utility = |r: &Candidate| {
                    let gain = r.authors.iter().fold(0u64, |sum, author| {
                        sum.saturating_add(match covered.get(author.as_str()) {
                            None => 2,
                            Some(1) => 1,
                            _ => 0,
                        })
                    });
                    r.weight.saturating_mul(1 + gain)
                };
                utility(a).cmp(&utility(b)).then_with(|| b.url.cmp(&a.url))
            });
        let Some(best) = best else { break };
        for author in &best.authors {
            *covered.entry(author.as_str()).or_default() += 1;
        }
        selected.push(best.url.clone());
    }
    selected
}

/// First useful arrivals receive credit, duplicate volume does not. Small
/// samples have a neutral prior; latency, failures and refusal reduce quality.
/// Callers retain cooling routes when no alternatives exist, so retry recovers.
pub fn weight(
    useful: u64,
    received: u64,
    latency_ms: Option<u64>,
    failures: u32,
    cooling: bool,
    refused: bool,
) -> u64 {
    if cooling {
        return 0;
    }
    let yield_score = 400u64.saturating_mul(useful.min(received).saturating_add(1))
        / received.saturating_add(2).max(1);
    let speed = 400_000 / latency_ms.unwrap_or(1000).saturating_add(1000);
    let quality = (200 + yield_score + speed) / (1 + u64::from(failures.min(8)));
    if refused { quality / 4 } else { quality }
}

impl super::Network {
    pub(in crate::engine) fn read_routes(
        &self,
        f: &lkjstr_protocol::NostrFilter,
        q: &crate::engine::protocol::Query,
        store: &crate::store::Store,
        now: u64,
    ) -> Vec<String> {
        use crate::engine::protocol::Source;
        let authors: BTreeMap<_, _> = f
            .authors
            .iter()
            .flatten()
            .filter_map(|author| store.relay_list(author).map(|list| (author, list)))
            .collect();
        let candidates: Vec<_> = self
            .relay_order
            .iter()
            .filter_map(|url| {
                let r = self.relays.get(url)?;
                let usage = self.known.get(url)?;
                if !(if q.source == Source::Search {
                    usage.search
                } else {
                    usage.read
                }) {
                    return None;
                }
                Some(Candidate {
                    url: url.clone(),
                    weight: weight(
                        r.useful,
                        r.received,
                        r.latency_ms,
                        r.failures,
                        (!r.online && !r.connecting && now < r.retry_at)
                            || (now < r.next_req_at
                                && r.last_error
                                    .as_deref()
                                    .is_some_and(|e| e.starts_with("rate-limited:"))),
                        r.last_error
                            .as_deref()
                            .is_some_and(|e| e.starts_with("auth-required:")),
                    ),
                    authors: authors
                        .iter()
                        .filter(|(_, list)| list.iter().any(|(u, _, write)| u == url && *write))
                        .map(|(author, _)| (*author).clone())
                        .collect(),
                })
            })
            .collect();
        select(
            &candidates,
            if matches!(q.source, Source::Channel | Source::Channels) {
                24
            } else {
                2
            },
        )
    }
}
