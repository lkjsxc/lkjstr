//! Keep author batches stable while notes stream in, so delayed replies survive.
use super::*;
impl Network {
    pub(super) fn stabilize_profiles(&self, desired: &mut Desired) {
        let keys: Vec<_> = desired
            .iter()
            .filter(|(_, (f, _))| f.kinds.as_deref() == Some(&[0]))
            .map(|(key, _)| key.clone())
            .collect();
        // At most 128 visible views x 4096 authors per configured relay.
        let mut pending: BTreeMap<String, BTreeMap<String, BTreeSet<String>>> = BTreeMap::new();
        for key in keys {
            if let Some((filter, members)) = desired.remove(&key) {
                for author in filter.authors.unwrap_or_default() {
                    pending
                        .entry(key.0.clone())
                        .or_default()
                        .entry(author)
                        .or_default()
                        .extend(members.clone());
                }
            }
        }
        for request in self
            .requests
            .values()
            .filter(|r| r.filter.kinds.as_deref() == Some(&[0]))
        {
            let Some(people) = pending.get_mut(&request.relay) else {
                continue;
            };
            let mut members = BTreeSet::new();
            for author in request.filter.authors.as_ref().into_iter().flatten() {
                if let Some(owners) = people.remove(author) {
                    members.extend(owners);
                }
            }
            if !members.is_empty() {
                desired.insert(
                    (
                        request.relay.clone(),
                        filter_to_value(&request.filter).to_string(),
                    ),
                    (request.filter.clone(), members),
                );
            }
        }
        for (relay, people) in pending {
            let people: Vec<_> = people.into_iter().collect();
            for chunk in people.chunks(120) {
                let filter = NostrFilter {
                    authors: Some(chunk.iter().map(|(a, _)| a.clone()).collect()),
                    kinds: Some(vec![0]),
                    limit: Some(chunk.len() as u64),
                    ..Default::default()
                };
                let members = chunk.iter().flat_map(|(_, m)| m.iter().cloned()).collect();
                desired.insert(
                    (relay.clone(), filter_to_value(&filter).to_string()),
                    (filter, members),
                );
            }
        }
    }
}

impl Request {
    pub(super) fn refresh_profile(&mut self, members: &BTreeSet<String>, now: u64) {
        if self.filter.kinds.as_deref() == Some(&[0])
            && self.complete
            && !members.is_subset(&self.members)
        {
            self.complete = false;
            self.eose = false;
            self.asked = false;
            self.ready_at = now;
        }
    }
}
