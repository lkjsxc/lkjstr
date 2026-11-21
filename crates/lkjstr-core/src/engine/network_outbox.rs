//! Verified NIP-65 read destinations. Twelve transient routes share the 64-socket budget.
use super::*;
use crate::store::Store;

fn advertised(f: &NostrFilter, q: &Query, store: &Store) -> BTreeMap<String, BTreeSet<String>> {
    let mut routes: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    if q.source == Source::Relay
        || f.kinds
            .as_ref()
            .is_none_or(|ks| ks.iter().any(|k| matches!(k, 4 | 1059 | 10002 | 10050)))
    {
        return routes;
    }
    let inbox = f.tags.contains_key("e") || f.tags.contains_key("p");
    let people: Vec<_> = if inbox {
        q.account.iter().collect()
    } else {
        f.authors.iter().flatten().take(6000).collect()
    };
    for author in people {
        for (url, read, write) in store
            .relay_list(author)
            .unwrap_or_default()
            .into_iter()
            .take(64)
        {
            if !(if inbox { read } else { write }) {
                continue;
            }
            let Some(url) = crate::engine::settings::strict_relay(&url) else {
                continue;
            };
            if routes.len() >= 256 && !routes.contains_key(&url) {
                continue;
            }
            routes.entry(url).or_default().insert(author.clone());
        }
    }
    routes
}

impl Network {
    pub(super) fn admit_outboxes(
        &mut self,
        wants: &[(String, NostrFilter, Query)],
        store: &Store,
        now: u64,
    ) {
        let mut needed: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for (_, filter, query) in wants.iter().filter(|(sub, _, _)| {
            !sub.starts_with('~') || crate::engine::time_window_older::is_owner(sub)
        }) {
            for (url, authors) in advertised(filter, query, store) {
                if needed.len() < 256 || needed.contains_key(&url) {
                    needed.entry(url).or_default().extend(authors);
                }
            }
        }
        let candidates: Vec<_> = needed
            .into_iter()
            .filter(|(url, _)| {
                !self.relay_order.contains(url) || self.known.get(url).is_none_or(|r| r.read)
            })
            .map(|(url, authors)| read_plan::Candidate {
                weight: self.relays.get(&url).map_or(600, |r| r.quality_weight(now)),
                url,
                authors,
            })
            .collect();
        self.read_outboxes = read_plan::select(&candidates, 12).into_iter().collect();
        for url in self.read_outboxes.clone() {
            if self.relays.contains_key(&url) || self.relays.len() >= 64 {
                continue;
            }
            self.relays.insert(
                url.clone(),
                Relay {
                    retry_at: now,
                    max_reqs: 4,
                    max_limit: 200,
                    ..Default::default()
                },
            );
            self.effects.push(Effect::Inspect(url.clone()));
            self.apply_quality(&url, now);
        }
    }

    pub(super) fn read_candidates(
        &self,
        f: &NostrFilter,
        q: &Query,
        store: &Store,
        now: u64,
    ) -> Vec<read_plan::Candidate> {
        let advertised = advertised(f, q, store);
        let mut urls = self.relay_order.clone();
        urls.extend(
            advertised
                .keys()
                .filter(|url| self.read_outboxes.contains(*url))
                .cloned(),
        );
        let mut seen = BTreeSet::new();
        urls.into_iter()
            .filter(|url| seen.insert(url.clone()))
            .filter_map(|url| {
                let relay = self.relays.get(&url)?;
                let usage = self.known.get(&url);
                let configured = usage.is_some_and(|usage| match q.source {
                    Source::Search => usage.search,
                    Source::Channels => usage.read || usage.search,
                    _ => usage.read,
                }) && self.relay_order.contains(&url);
                let permitted = advertised.contains_key(&url)
                    && self.read_outboxes.contains(&url)
                    && (!self.relay_order.contains(&url) || usage.is_none_or(|r| r.read));
                if !configured && !permitted {
                    return None;
                }
                // Configured routes can also be advertised; their role is query-scoped.
                let authors = advertised.get(&url).cloned().unwrap_or_default();
                Some(read_plan::Candidate {
                    url,
                    weight: relay.quality_weight(now),
                    authors,
                })
            })
            .collect()
    }
}
