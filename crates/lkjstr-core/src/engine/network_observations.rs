//! Bounded routing diagnostics: no event bodies, public keys or secret material.
use super::*;
impl Network {
    pub fn request_stats(&self) -> Value {
        json!(
            self.requests
                .iter()
                .take(256)
                .map(|(id, r)| json!({
                    "id":id,"relay":r.relay,"wireId":r.wire_id,"purpose":r.purpose,
                    "priority":r.priority,"weight":r.weight,"received":r.received.len(),
                    "sent":r.sent,"complete":r.page_eose,"members":r.members.len()
                }))
                .collect::<Vec<_>>()
        )
    }
    pub fn followed_coverage(
        &self,
        followed: &BTreeSet<String>,
        store: &crate::store::Store,
    ) -> BTreeMap<String, usize> {
        let mut asked: BTreeMap<&str, BTreeSet<&str>> = BTreeMap::new();
        for r in self
            .requests
            .values()
            .filter(|r| r.sent && r.filter.kinds.as_ref().is_some_and(|ks| ks.contains(&1)))
        {
            for author in r
                .filter
                .authors
                .iter()
                .flatten()
                .filter(|a| followed.contains(*a))
            {
                asked.entry(&r.relay).or_default().insert(author);
            }
        }
        let mut coverage = BTreeMap::new();
        for person in followed {
            let routes: BTreeSet<_> = store
                .relay_list(person)
                .unwrap_or_default()
                .into_iter()
                .filter(|(_, _, write)| *write)
                .map(|(url, _, _)| url)
                .collect();
            for url in routes {
                if asked
                    .get(url.as_str())
                    .is_some_and(|authors| authors.contains(person.as_str()))
                {
                    *coverage.entry(url).or_default() += 1;
                }
            }
        }
        coverage
    }
    pub fn routing_stats(&self, url: &str, covered: usize) -> Value {
        let active = self.requests.values().any(|r| r.relay == url);
        let known = self.known.get(url);
        let rule = if !active {
            "unused"
        } else if known.is_some_and(|r| r.read) {
            "reader"
        } else if known.is_some_and(|r| r.search) {
            "search"
        } else {
            "hint"
        };
        let route = match known {
            Some(r) if r.read && r.write => "both",
            Some(r) if r.read => "reading",
            Some(r) if r.write => "writing",
            Some(r) if r.search => "search",
            Some(_) => "own",
            None if active => "reading",
            None => "unused",
        };
        json!({"route":route,"readRule":rule,"followedCovered":covered,
            "weight":self.relays.get(url).map(|r| r.quality_weight(self.now))})
    }
    pub fn open_wires(&self) -> BTreeMap<&str, usize> {
        let mut out = BTreeMap::new();
        let mut seen = BTreeSet::new();
        for r in self.requests.values().filter(|r| r.sent) {
            if seen.insert((&r.relay, &r.wire_id)) {
                *out.entry(r.relay.as_str()).or_default() += 1;
            }
        }
        out
    }
}
