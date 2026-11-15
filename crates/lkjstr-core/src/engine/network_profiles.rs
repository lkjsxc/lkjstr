//! Coalesce hydration during a 75 ms window; keep transmitted buckets immutable.
use super::*;

// Exclude owner refreshes, cursored pages and follow watches.
pub(super) fn family(f: &NostrFilter, members: &BTreeSet<String>) -> Option<u8> {
    if members.iter().any(|m| m.starts_with('~'))
        || f.since.is_some()
        || f.until.is_some()
        || f.search.is_some()
    {
        return None;
    }
    if f.ids.is_some() && f.kinds.is_none() && f.tags.is_empty() {
        return Some(1);
    }
    if f.authors.is_some() && f.tags.is_empty() {
        return match f.kinds.as_deref() {
            Some([0]) => Some(0),
            Some([3]) => Some(3),
            _ => None,
        };
    }
    if f.authors.is_none() && f.tags.len() == 1 && f.tags.contains_key("e") {
        return match f.kinds.as_deref() {
            Some([1, 6, 7, 9735]) => Some(2),
            Some([42, 16, 7, 9735]) => Some(4),
            Some([1, 42, 6, 16, 7, 9735]) => Some(5),
            _ => None,
        };
    }
    None
}
impl Request {
    pub(super) fn refresh_profile(
        &mut self,
        members: &BTreeSet<String>,
        explicit: &BTreeSet<String>,
        now: u64,
    ) {
        if (self.complete || (!self.sent && self.page_eose))
            && self.filter.kinds.as_deref() == Some(&[0])
            && members
                .difference(&self.members)
                .any(|m| explicit.contains(m))
        {
            self.complete = false;
            self.eose = false;
            self.page_eose = false;
            self.asked = false;
            self.ready_at = now;
        }
    }
}
fn keys(f: &NostrFilter, kind: u8) -> Vec<String> {
    match kind {
        0 | 3 => f.authors.clone(),
        1 => f.ids.clone(),
        _ => f.tags.get("e").cloned(),
    }
    .unwrap_or_default()
}
impl Network {
    pub(super) fn stabilize_profiles(
        &mut self,
        desired: &mut Desired,
        live_lists: &BTreeSet<String>,
    ) {
        // Bounded by visible wants (128 views x 6000 authors), released on hiding.
        let mut pending: BTreeMap<(String, u8), BTreeMap<String, BTreeSet<String>>> =
            BTreeMap::new();
        let selected: Vec<_> = desired
            .iter()
            .filter(|(_, (f, members))| !lists::watch(f, members, live_lists))
            .filter_map(|(key, (f, members))| family(f, members).map(|kind| (key.clone(), kind)))
            .collect();
        for (key, kind) in selected {
            if let Some((filter, members)) = desired.remove(&key) {
                for item in keys(&filter, kind) {
                    pending
                        .entry((key.0.clone(), kind))
                        .or_default()
                        .entry(item)
                        .or_default()
                        .extend(members.clone());
                }
            }
        }
        for ((relay, kind), mut items) in pending {
            let wanted_keys: BTreeSet<_> = items.keys().cloned().collect();
            // Never enlarge a wire request or re-request an in-flight/completed item.
            for request in self.requests.values().filter(|r| {
                r.relay == relay
                    && !r.list_watch
                    && r.asked
                    && family(&r.page_filter, &r.members) == Some(kind)
                    && (matches!(kind, 0 | 1 | 3)
                        || keys(&r.page_filter, kind)
                            .iter()
                            .all(|key| wanted_keys.contains(key))
                            && keys(&r.page_filter, kind).len() == wanted_keys.len())
            }) {
                let mut members = BTreeSet::new();
                for item in keys(&request.page_filter, kind) {
                    if let Some(owners) = items.remove(&item) {
                        members.extend(owners);
                    }
                }
                if !members.is_empty() {
                    desired
                        .entry((
                            relay.clone(),
                            filter_to_value(&request.page_filter).to_string(),
                        ))
                        .or_insert_with(|| (request.page_filter.clone(), BTreeSet::new()))
                        .1
                        .extend(members);
                }
            }
            let cap = if matches!(kind, 0 | 1 | 3) {
                self.relays[&relay].max_limit.min(120) as usize
            } else {
                120
            }
            .max(1);
            let items: Vec<_> = items.into_iter().collect();
            for chunk in items.chunks(cap) {
                let values: Vec<_> = chunk.iter().map(|(k, _)| k.clone()).collect();
                let mut filter = NostrFilter {
                    limit: Some(if matches!(kind, 0 | 1 | 3) {
                        values.len() as u64
                    } else {
                        200
                    }),
                    ..Default::default()
                };
                match kind {
                    0 | 3 => {
                        filter.authors = Some(values);
                        filter.kinds = Some(vec![if kind == 0 { 0 } else { 3 }]);
                    }
                    1 => filter.ids = Some(values),
                    _ => {
                        filter.tags.insert("e".into(), values);
                        filter.kinds = Some(match kind {
                            2 => vec![1, 6, 7, 9735],
                            4 => vec![42, 16, 7, 9735],
                            _ => vec![1, 42, 6, 16, 7, 9735],
                        });
                    }
                }
                let members: BTreeSet<_> =
                    chunk.iter().flat_map(|(_, m)| m.iter().cloned()).collect();
                // Reuse the unsent bucket's original deadline during arrivals.
                if let Some(r) = self.requests.values_mut().find(|r| {
                    r.relay == relay
                        && !r.asked
                        && family(&r.page_filter, &r.members) == Some(kind)
                        && keys(&r.page_filter, kind)
                            .iter()
                            .any(|v| keys(&filter, kind).contains(v))
                }) {
                    r.filter = filter.clone();
                    r.page_filter = filter.clone();
                }
                desired
                    .entry((relay.clone(), filter_to_value(&filter).to_string()))
                    .or_insert_with(|| (filter, BTreeSet::new()))
                    .1
                    .extend(members);
            }
        }
    }
    pub(super) fn hydration_ready(
        &self,
        filter: &NostrFilter,
        members: &BTreeSet<String>,
        now: u64,
    ) -> u64 {
        if family(filter, members).is_some() {
            now + 75
        } else {
            now
        }
    }
}
